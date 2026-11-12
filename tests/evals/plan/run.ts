/**
 * Evals del plan semanal: 8 pedidos contra la IA real y la DB local (cuestan unos centavos). NO corren en CI.
 * Requiere `pnpm db:start`. Crea usuarios y datos de prueba nuevos en cada corrida.
 *
 *   pnpm eval:plan            # los 8 pedidos
 *   pnpm eval:plan 1 3        # solo los pedidos 1 y 3
 *   EVAL_VERBOSE=1 pnpm eval:plan 1   # imprime el plan armado y la respuesta
 *
 * Chequeos: 0 errores de validatePlan, ≤ 2 avisos de monotonía de proteína, ≥ 70 % de recetas del
 * recetario (no inventadas), ninguna receta repetida sin ser sobra.
 */
import { createClient } from "@supabase/supabase-js";
import { runPlanAgent } from "@/lib/ai/plan-agent/agent";
import { buildPlanSystemPrompt } from "@/lib/ai/plan-agent/prompt";
import { validateCandidates, type Candidate } from "@/lib/ai/plan-agent/validation";
import { MODELS } from "@/lib/ai/models";
import { sortSlots, type MealSlot } from "@/lib/domain/meal-slots";
import { addDays, dayLabel, formatWeekLabel, weekDays } from "@/lib/domain/week";
import { getPlanEntries } from "@/lib/plan/queries";
import { addMemberToGroup, adminClient, createTestUser } from "../../e2e/helpers/auth";
import { createGroupAs, seedRecipe } from "../../e2e/helpers/recipes";
import { PLAN_RECIPES, PLAN_REQUESTS } from "./recipes";

process.loadEnvFile(".env.local");

const PRICES: Record<string, { in: number; out: number }> = {
  "claude-haiku-5-5": { in: 1, out: 5 },
  "claude-sonnet-5-5": { in: 3, out: 15 },
};
const password = "password123";

async function main() {
  const only = process.argv.slice(2).map(Number);
  const run = Date.now();
  const aEmail = `eval-plan-a-${run}@test.com`;
  const bEmail = `eval-plan-b-${run}@test.com`;
  const aId = await createTestUser(aEmail, password, "Ana");
  const bId = await createTestUser(bEmail, password, "Beto");
  const groupId = await createGroupAs(aEmail, password, "Casa Eval");
  await addMemberToGroup(groupId, bId);

  const admin = adminClient();
  // Ana: sin cebolla y poca harina. Beto: sin restricciones.
  await admin.from("food_profiles").insert({
    user_id: aId,
    summary: "Sin cebolla; limita las harinas",
    data: {
      restrictions: [
        { target: "cebolla", type: "ingredient", severity: "forbidden", reason: "tratamiento" },
        { target: "harinas", type: "category", severity: "limit", limit: "pocas harinas" },
      ],
      goals: ["bajo en carbohidratos"],
      likes: [],
      dislikes: [],
      cuisines: [],
      schedule: {},
    },
  });

  console.log(`Sembrando ${PLAN_RECIPES.length} recetas…`);
  // EVAL_EMPTY=1: grupo sin recetas propias → el agente tiene que usar el catálogo público.
  for (const rec of process.env.EVAL_EMPTY === "1" ? [] : PLAN_RECIPES) {
    await seedRecipe(aEmail, password, groupId, rec);
    process.stdout.write(".");
  }
  console.log(" ok");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: aEmail,
    password,
  });
  if (authError) throw authError;

  const { data: group } = await supabase
    .from("groups")
    .select("meal_slots")
    .eq("id", groupId)
    .single();
  const slots = sortSlots(group?.meal_slots ?? []) as MealSlot[];
  const { data: activeRecipes } = await supabase
    .from("recipes")
    .select("id")
    .eq("group_id", groupId)
    .eq("status", "active");
  const libraryIds = new Set((activeRecipes ?? []).map((r) => r.id));

  let passed = 0;
  let total = 0;
  let totalCost = 0;
  const failures: string[] = [];

  for (const [i, request] of PLAN_REQUESTS.entries()) {
    if (only.length && !only.includes(i + 1)) continue;
    total++;
    // Cada pedido en una semana distinta (un plan vigente por semana).
    const weekStart = `2027-0${1 + Math.floor(i / 4)}-${["04", "11", "18", "25"][i % 4]}`;
    const { data: plan, error } = await supabase
      .from("meal_plans")
      .insert({ group_id: groupId, week_start: weekStart, created_by: aId })
      .select("id")
      .single();
    if (error || !plan) throw error ?? new Error("no se pudo crear el plan");

    const context = [
      `Plan de la semana: ${formatWeekLabel(weekStart)} (empieza el ${weekStart}).`,
      `Días: ${weekDays(weekStart)
        .map((d) => `${d} (${dayLabel(d)})`)
        .join(", ")}.`,
      `Momentos habilitados: ${slots.join(", ")}.`,
    ].join("\n");

    let tokensIn = 0;
    let tokensOut = 0;
    const started = Date.now();
    const result = await runPlanAgent(
      {
        model: MODELS.smart,
        system: buildPlanSystemPrompt(),
        history: [],
        userContent: `${context}\n\n---\n${request}`,
        toolCtx: {
          supabase,
          userId: aId,
          groupId,
          planId: plan.id,
          weekStart,
          endDate: addDays(weekStart, 6),
          slots,
          emit: () => {},
        },
        emit: () => {},
      },
      {
        record: async (row) => {
          tokensIn = row.input_tokens;
          tokensOut = row.output_tokens;
          return null;
        },
      },
    );
    const seconds = (Date.now() - started) / 1000;
    const price = PRICES[MODELS.smart]!;
    const cost = (tokensIn * price.in + tokensOut * price.out) / 1_000_000;
    totalCost += cost;

    // Las recetas guardadas desde el catálogo durante el pedido también cuentan como del recetario.
    const { data: nowActive } = await supabase
      .from("recipes")
      .select("id")
      .eq("group_id", groupId)
      .eq("status", "active");
    for (const r of nowActive ?? []) libraryIds.add(r.id);
    const entries = await getPlanEntries(plan.id, supabase);
    const candidates: Candidate[] = entries.map((e) => ({
      id: e.id,
      date: e.date,
      slot: e.slot,
      recipe_id: e.recipe_id,
      free_text: e.free_text,
      servings: e.servings,
      diner_ids: e.diner_ids,
      cook_date: e.cook_date,
      leftovers_of_entry_id: e.leftovers_of_entry_id,
      is_new_recipe: e.is_new_recipe,
    }));
    const v = await validateCandidates(supabase, groupId, candidates, weekStart);
    const withRecipe = entries.filter((e) => e.recipe_id);
    const fromLibrary = withRecipe.filter((e) => libraryIds.has(e.recipe_id!)).length;
    const share = withRecipe.length ? fromLibrary / withRecipe.length : 0;
    const monotony = v.warnings.filter((w) => w.code === "PROTEIN_MONOTONY").length;
    const repeated = v.warnings.filter((w) => w.code === "REPEATED_RECIPE").length;

    const problems: string[] = [];
    if (!result.ok) problems.push(`el agente falló: ${result.error}`);
    if (entries.length === 0) problems.push("no armó ninguna comida");
    if (v.errors.length)
      problems.push(
        `${v.errors.length} errores de validatePlan: ${v.errors.map((e) => e.message).join(" | ")}`,
      );
    if (monotony > 2) problems.push(`${monotony} avisos de monotonía`);
    if (share < 0.7) problems.push(`solo ${(share * 100).toFixed(0)} % de recetas del recetario`);
    if (repeated > 0) problems.push(`${repeated} recetas repetidas sin ser sobras`);

    const ok = problems.length === 0;
    if (ok) passed++;
    else failures.push(`#${i + 1}: ${problems.join("; ")}`);
    console.log(
      `${ok ? "✅" : "❌"} #${i + 1} ${request}\n   ${entries.length} comidas · ${(share * 100).toFixed(0)} % del recetario · ${v.warnings.length} avisos · ${seconds.toFixed(0)} s · US$ ${cost.toFixed(3)}`,
    );
    if (process.env.EVAL_VERBOSE || !ok) {
      for (const e of entries)
        console.log(
          `     ${e.date} ${e.slot}: ${e.recipe?.title ?? e.free_text}${e.leftovers_of_entry_id ? " (sobras)" : ""}`,
        );
      if (result.text) console.log(`   > ${result.text.replace(/\n/g, "\n   > ")}`);
      for (const w of v.warnings) console.log(`   ⚠️ ${w.message}`);
    }
  }

  console.log(`\n${passed}/${total} sin problemas · costo total US$ ${totalCost.toFixed(3)}`);
  if (failures.length) console.log(failures.join("\n"));
  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => {
  console.error("EVAL ERROR", e);
  process.exit(2);
});
