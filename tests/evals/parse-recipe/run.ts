/**
 * Evals de parseo de recetas: llaman a la API real (cuestan centavos). NO corren en CI.
 *
 *   pnpm eval:parse            # los 15 casos
 *   pnpm eval:parse 07 13      # solo los casos cuyo id empieza con 07 o 13
 */
import { readdirSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");

type Case = {
  id: string;
  kind: "text" | "voice" | "image";
  text?: string;
  transcript?: string;
  image?: string;
  expected_ingredients: number;
  key_ingredients: string[];
  has_timed_passive_step: boolean;
};

const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
// Un paso "tiene verbo" si en sus primeras palabras hay un imperativo voseante ("Cortá", "Batí", con o
// sin pronombre: "Hervílos", "Ponelo") o un infinitivo ("Hervir", "Pisarlas"). Las locuciones del
// principio ("Al final, salá…") no cuentan como falta de verbo.
const VOSEO = /^[a-zñ]+[áéí]s?(?:l[oa]s?|se|le)?$/; // incluye "Rellená" y "Rellenás"
const IRREGULAR = /^(?:dal[oae]s?|ponel[oae]s?|hacel[oae]s?|decil[oae]s?|vel[oae]s?)$/; // "Dale", "Ponelo"…
const INFINITIVE = /^[a-zñ]{3,}(?:ar|er|ir)(?:l[oa]s?|se)?$/;
const hasVerb = (instruction: string) =>
  instruction
    .toLowerCase()
    .split(/\s+/)
    .slice(0, 5)
    .map((w) => w.replace(/[^a-zñáéíóú]/g, ""))
    .some((w) => VOSEO.test(w) || IRREGULAR.test(w) || INFINITIVE.test(w));

// Precios aproximados por millón de tokens (USD). Son una estimación, no la factura.
const PRICES = {
  "claude-haiku-5-5": { in: 1, out: 5 },
  "claude-sonnet-5-5": { in: 3, out: 15 },
} as Record<string, { in: number; out: number }>;

async function main() {
  const filters = process.argv.slice(2);
  const dir = "tests/evals/parse-recipe/cases";
  const cases: Case[] = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(`${dir}/${f}`, "utf8")) as Case)
    .filter((c) => filters.length === 0 || filters.some((f) => c.id.startsWith(f)));

  const { runStructured } = await import("../../../lib/ai/run-structured");
  const { MODELS } = await import("../../../lib/ai/models");
  const { PARSE_RECIPE_SYSTEM } = await import("../../../lib/ai/prompts/parse-recipe");
  const { aiRecipeOutputSchema } = await import("../../../lib/schemas/ai-recipe");

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data: created, error } = await admin.auth.admin.createUser({
    email: `eval-${Date.now()}@test.com`,
    password: "password123",
    email_confirm: true,
  });
  if (error || !created.user) throw error ?? new Error("No se pudo crear el usuario de prueba");
  const userId = created.user.id;

  const rows: { id: string; ok: boolean; notes: string[]; ms: number }[] = [];
  try {
    for (const c of cases) {
      const t0 = Date.now();
      const model = c.kind === "image" ? MODELS.smart : MODELS.fast;
      const content =
        c.kind === "image"
          ? [
              {
                type: "image" as const,
                source: {
                  type: "base64" as const,
                  media_type: "image/png" as const,
                  data: readFileSync(c.image!).toString("base64"),
                },
              },
              {
                type: "text" as const,
                text: "Estructurá la receta que aparece en estas fotos, en el orden en que se ven.",
              },
            ]
          : (c.text ?? c.transcript)!;

      const run = await runStructured({
        feature: "eval_parse_recipe",
        model,
        system: PARSE_RECIPE_SYSTEM,
        content,
        schema: aiRecipeOutputSchema,
        userId,
        toolName: "guardar_receta",
        maxTokens: 6000,
      });

      const notes: string[] = [];
      if (!run.ok) {
        rows.push({
          id: c.id,
          ok: false,
          notes: ["la IA falló o devolvió JSON inválido"],
          ms: Date.now() - t0,
        });
        continue;
      }
      const r = run.data;
      if (!r.is_recipe) notes.push("is_recipe = false");
      if (Math.abs(r.ingredients.length - c.expected_ingredients) > 1) {
        notes.push(`ingredientes: ${r.ingredients.length} (esperaba ${c.expected_ingredients}±1)`);
      }
      const names = r.ingredients.map((i) => normalize(`${i.name_canonical} ${i.raw_text}`));
      const missing = c.key_ingredients.filter((k) => !names.some((n) => n.includes(normalize(k))));
      if (missing.length) notes.push(`faltan: ${missing.join(", ")}`);
      const noVerb = r.steps.filter((s) => !hasVerb(s.instruction));
      if (noVerb.length)
        notes.push(
          `pasos sin verbo: ${noVerb.map((s) => `"${s.instruction.slice(0, 25)}…"`).join(" | ")}`,
        );
      if (c.has_timed_passive_step) {
        const ovenSteps = r.steps.filter((s) => /horne|horno/i.test(s.instruction));
        const okOven =
          ovenSteps.length > 0 &&
          ovenSteps.some((s) => s.timer_kind === "passive" && s.duration_seconds);
        if (!okOven) notes.push("el paso de horno no es pasivo con duración");
      }
      rows.push({ id: c.id, ok: notes.length === 0, notes, ms: Date.now() - t0 });
    }

    // Tokens y costo estimado de esta corrida.
    const { data: runs } = await admin
      .from("ai_runs")
      .select("model, input_tokens, output_tokens")
      .eq("user_id", userId);
    let cost = 0;
    for (const r of runs ?? []) {
      const p = PRICES[r.model] ?? { in: 3, out: 15 };
      cost += ((r.input_tokens ?? 0) * p.in + (r.output_tokens ?? 0) * p.out) / 1_000_000;
    }

    console.log("\nCaso                          Resultado   Tiempo   Notas");
    for (const r of rows) {
      console.log(
        `${r.id.padEnd(30)}${(r.ok ? "OK" : "FALLA").padEnd(12)}${String(r.ms + " ms").padEnd(9)}${r.notes.join(" · ")}`,
      );
    }
    const passed = rows.filter((r) => r.ok).length;
    const pct = rows.length ? Math.round((passed / rows.length) * 100) : 0;
    console.log(
      `\n${passed}/${rows.length} casos pasan (${pct}%). Costo estimado: USD ${cost.toFixed(3)} (${runs?.length ?? 0} llamadas).`,
    );
    if (pct < 90) process.exitCode = 1;
  } finally {
    await admin.auth.admin.deleteUser(userId);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
