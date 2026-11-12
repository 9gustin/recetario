/**
 * Evals del plan vivo (IA real + DB local, no corren en CI):
 *  - digitalización de 3 planes de ejemplo (texto, dictado y texto con tabla): comidas y permitidos detectados;
 *  - ajuste por chat: "no me gusta el yogur del desayuno" → reemplazos válidos, ninguno prohibido por el perfil.
 *
 *   pnpm eval:diet
 * Un PDF o foto reales se prueban a mano subiéndolos en /perfil/plan/digitalizar.
 */
import { createClient } from "@supabase/supabase-js";
import { runPlanAgent } from "@/lib/ai/plan-agent/agent";
import { dietToolDefinitions, runDietTool, type DietToolCtx } from "@/lib/ai/diet-plan/tools";
import { buildDietChatPrompt } from "@/lib/ai/diet-plan/prompt";
import { ingestDietPlan } from "@/lib/ai/diet-plan/ingest";
import { MODELS } from "@/lib/ai/models";
import { adminClient, createTestUser } from "../../e2e/helpers/auth";

process.loadEnvFile(".env.local");
const password = "password123";

const SAMPLES = [
  {
    name: "texto",
    meals: 4,
    allowances: 2,
    input: {
      text: `Plan semanal. Desayuno: 1 yogur descremado con 1 fruta y 2 tostadas integrales. Almuerzo: 150 g de proteína (pollo, pescado o carne magra), verduras libres y media taza de arroz integral. Merienda: 1 café con leche y una fruta. Cena: proteína y verduras, sin harinas. Permitidos: 2 comidas libres por semana. Regla: tomar 2 litros de agua por día.`,
    },
  },
  {
    name: "dictado",
    meals: 3,
    allowances: 1,
    input: {
      transcript: `Mi nutricionista me dijo que desayune lácteo con fruta, que almuerce proteína con ensalada y que a la noche coma liviano, sin pan ni pastas. Puedo tener una comida libre por semana, nada más.`,
    },
  },
  {
    name: "tabla",
    meals: 3,
    allowances: 3,
    input: {
      text: `MOMENTO | FÓRMULA | PORCIÓN\nDesayuno | Lácteo + cereal | 1 taza + 30 g\nAlmuerzo | Proteína + verduras + carbohidrato | 150 g + libre + 1/2 taza\nCena | Proteína + verduras | 150 g + libre\nPermitidos: 3 por semana (una comida libre o un postre). Revisión: 15/03/2027.`,
    },
  },
];

async function main() {
  const email = `eval-diet-${Date.now()}@test.com`;
  const userId = await createTestUser(email, password, "Ana");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  await supabase.auth.signInWithPassword({ email, password });
  // Perfil con frutos secos prohibidos (para validar los reemplazos).
  await adminClient()
    .from("food_profiles")
    .insert({
      user_id: userId,
      summary: "Alergia a frutos secos",
      data: {
        restrictions: [{ target: "frutos_secos", type: "family", severity: "forbidden" }],
        goals: [],
        likes: [],
        dislikes: [],
        cuisines: [],
        schedule: {},
      },
    });

  let ok = 0;
  let total = 0;
  let lastPlanId = "";
  for (const s of SAMPLES) {
    total++;
    const started = Date.now();
    const res = await ingestDietPlan(supabase, userId, s.input);
    const seconds = ((Date.now() - started) / 1000).toFixed(0);
    if (!res.ok) {
      console.log(`❌ ${s.name}: ${res.error}`);
      continue;
    }
    const { draft } = res.data;
    lastPlanId = res.data.planId;
    const good = draft.meals.length >= s.meals && draft.allowances.per_week === s.allowances;
    if (good) ok++;
    console.log(
      `${good ? "✅" : "❌"} ${s.name}: ${draft.meals.length} comidas (esperadas ≥ ${s.meals}), permitidos ${draft.allowances.per_week} (esperados ${s.allowances}), ${draft.rules.length} reglas, ${seconds} s`,
    );
  }

  // Ajuste por chat sobre el último plan digitalizado.
  total++;
  const { data: meals } = await supabase
    .from("diet_plan_meals")
    .select("id, slot")
    .eq("plan_id", lastPlanId);
  const breakfast = meals?.find((m) => m.slot === "breakfast")?.id;
  const events: string[] = [];
  const result = await runPlanAgent<DietToolCtx>(
    {
      model: MODELS.smart,
      system: buildDietChatPrompt(),
      history: [],
      userContent: `PLAN: desayuno id ${breakfast}.\n\n---\nNo me gusta el yogur del desayuno. Proponeme reemplazos (soy alérgica a los frutos secos).`,
      toolCtx: {
        supabase,
        userId,
        groupId: null,
        planId: lastPlanId,
        emit: (e) => events.push(e.type),
      },
      tools: dietToolDefinitions(),
      feature: "diet_plan_chat",
      emit: () => {},
      maxIterations: 8,
    },
    { executeTool: runDietTool, record: async () => null },
  );
  const text = result.ok ? result.text : "";
  const nuts = /(almendra|nuez|nueces|castaña|pistacho|avellana|man[ií]\b|frutos secos)/i.test(
    text,
  );
  const goodChat = result.ok && text.length > 20 && !nuts;
  if (goodChat) ok++;
  console.log(
    `${goodChat ? "✅" : "❌"} ajuste: ${result.ok ? "respondió" : result.error}${nuts ? " — sugirió frutos secos" : ""}\n   > ${text.replace(/\n/g, "\n   > ")}`,
  );

  console.log(`\n${ok}/${total}`);
  process.exit(ok / total >= 0.9 ? 0 : 1);
}

main().catch((e) => {
  console.error("EVAL ERROR", e);
  process.exit(2);
});
