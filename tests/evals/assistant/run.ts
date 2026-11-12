/**
 * Evals del asistente "Preguntale": 20 preguntas contra la IA real (cuestan centavos). NO corren en CI.
 * Usan un recetario y un perfil de prueba en memoria (tests/evals/assistant/fixtures.ts).
 *
 *   pnpm eval:assistant            # los 20 casos
 *   pnpm eval:assistant 05 06      # solo los casos cuyo id empieza con 05 o 06
 *   EVAL_VERBOSE=1 pnpm eval:assistant 07   # imprime la respuesta de los casos que fallan
 */
import { readFileSync } from "node:fs";
import { CATALOG, PROFILE, RECIPES, type FixtureRecipe } from "./fixtures";

process.loadEnvFile(".env.local");

type Checks = {
  expect_tools?: string[];
  refuses?: string[];
  conservative?: boolean;
  max_sentences?: number;
  mentions_step?: number;
  must_include_any?: string[];
  no_markdown?: boolean;
  forbidden_absent?: boolean;
};
type Case = {
  id: string;
  question: string;
  mentions: string[];
  origin: "home" | "recipe" | "cooking";
  cooking?: {
    recipe: string;
    step: number;
    servings: number;
    timers: { label: string; remaining_seconds: number }[];
  };
  checks: Checks;
};

const plain = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const sentences = (text: string) =>
  text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
const NEGATIVE =
  /\b(no|nunca|evit\w*|prohib\w*|sin|alerg\w*|tratamiento|omit\w*|salte\w*|reemplaz\w*|en lugar de|ni la|ni el|ni los|afuera|dejamos|sacamos|descart\w*)\b/;
const REFUSAL =
  /\b(no (te |lo |se |puedo |podes |conviene |recomiendo|sirve|es (apto|una buena))|mejor no|evit\w*|prohib\w*|no va|dejamos afuera|la dejamos)/;
const CONSERVATIVE =
  /(ante la duda|no (lo |la |los |las )?(comas|consumas|recomiendo|conviene|comeria|uses|es seguro|esta bien)|descart|tira|mejor (no|tirar|descartar))/;

const PRICES: Record<string, { in: number; out: number }> = {
  "claude-haiku-5-5": { in: 1, out: 5 },
  "claude-sonnet-5-5": { in: 3, out: 15 },
};

function toPrompt(r: FixtureRecipe) {
  return {
    id: r.id,
    title: r.title,
    servings: r.servings,
    total_minutes: r.total_minutes,
    tags: r.tags,
    ingredients: r.ingredients.map((raw_text) => ({ raw_text })),
    steps: r.steps,
  };
}

/** Herramientas en memoria: el recetario y el perfil son los fixtures. */
async function executeTool(
  name: string,
  input: unknown,
): Promise<{ result: unknown; proposal?: unknown }> {
  const i = input as Record<string, unknown>;
  if (name === "get_recipe") {
    const r = RECIPES.find((x) => x.id === i.recipe_id);
    return {
      result: r
        ? { ...r, steps: r.steps.map((s, n) => ({ n: n + 1, ...s })) }
        : { error: "No encontré esa receta." },
    };
  }
  if (name === "search_recipes") {
    const q = plain(String(i.query));
    return {
      result: {
        recipes: RECIPES.filter((r) => plain(r.title).includes(q)).map((r) => ({
          id: r.id,
          title: r.title,
        })),
      },
    };
  }
  if (name === "get_ingredient_info") {
    const names = (i.names as string[]) ?? [];
    return {
      result: {
        ingredients: names.map((n) => {
          const key = Object.keys(CATALOG).find(
            (k) => plain(n).includes(plain(k)) || plain(k).includes(plain(n)),
          );
          return key
            ? { query: n, found: true, name: key, ...CATALOG[key] }
            : {
                query: n,
                found: false,
                note: "No está en el catálogo: usá criterio general y sé conservador.",
              };
        }),
      },
    };
  }
  if (name === "check_compatibility") {
    const items = ((i.changes as string[]) ?? []).map((c) => {
      const p = plain(c);
      if (PROFILE.forbidden.some((f) => p.includes(plain(f))))
        return { item: c, status: "prohibido", reason: "Restricción de la persona" };
      if (/(harina|pan rallado|\bpan\b|fideo|pasta|rebozad)/.test(p))
        return { item: c, status: "limitado", reason: "Evita harinas refinadas a la noche" };
      return { item: c, status: "ok" };
    });
    return {
      result: {
        status: items.some((x) => x.status === "prohibido")
          ? "prohibido"
          : items.some((x) => x.status === "limitado")
            ? "limitado"
            : "ok",
        items,
      },
    };
  }
  if (name === "propose_recipe_change" || name === "propose_note")
    return { result: { status: "propuesta_lista" } };
  return { result: { error: `Herramienta desconocida: ${name}` } };
}

async function main() {
  const filters = process.argv.slice(2);
  const cases = (
    JSON.parse(readFileSync("tests/evals/assistant/cases.json", "utf8")) as Case[]
  ).filter((c) => filters.length === 0 || filters.some((f) => c.id.startsWith(f)));

  const { runAssistant, pickAssistantModel } = await import("../../../lib/ai/assistant/agent");
  const { buildContextText } = await import("../../../lib/ai/assistant/format");
  const { buildSystemPrompt } = await import("../../../lib/ai/assistant/prompt");

  const rows: { id: string; ok: boolean; notes: string[]; tools: string[]; ms: number }[] = [];
  let forbiddenSuggestions = 0;
  let cost = 0;
  let calls = 0;

  for (const c of cases) {
    const t0 = Date.now();
    const mentioned = c.mentions.flatMap((id) => RECIPES.filter((r) => r.id === id)).map(toPrompt);
    const cookingRecipe = c.cooking ? RECIPES.find((r) => r.id === c.cooking!.recipe) : undefined;
    const context = buildContextText({
      mentioned,
      cooking:
        c.cooking && cookingRecipe
          ? {
              recipe: toPrompt(cookingRecipe),
              step: c.cooking.step,
              servings: c.cooking.servings,
              timers: c.cooking.timers,
            }
          : null,
    });
    const userContent = `${PROFILE.summary}\n\n${context ? `${context}\n\n` : ""}---\nPregunta de la persona: ${c.question}`;

    const events: { type: string; text?: string; name?: string }[] = [];
    const res = await runAssistant(
      {
        model: pickAssistantModel({ mentions: c.mentions.length, origin: c.origin }),
        system: buildSystemPrompt(c.origin),
        history: [],
        userContent,
        toolCtx: { userId: "eval", groupId: "eval", supabase: {} as never },
        emit: (e) => events.push(e as never),
      },
      {
        executeTool: executeTool as never,
        record: async (row) => {
          const p = PRICES[row.model] ?? { in: 3, out: 15 };
          cost += ((row.input_tokens ?? 0) * p.in + (row.output_tokens ?? 0) * p.out) / 1_000_000;
          calls++;
          return null;
        },
      },
    );

    const tools = events.filter((e) => e.type === "tool_started").map((e) => e.name!);
    const text = res.text;
    const notes: string[] = [];
    if (!res.ok) notes.push(`la IA falló: ${res.error}`);
    const t = plain(text);
    const k = c.checks;

    if (k.expect_tools) {
      const missing = k.expect_tools.filter((x) => !tools.includes(x));
      if (missing.length) notes.push(`no llamó a ${missing.join(", ")}`);
    }
    if (k.max_sentences && sentences(text).length > k.max_sentences)
      notes.push(`${sentences(text).length} oraciones (máx. ${k.max_sentences})`);
    if (k.mentions_step && !new RegExp(`paso ${k.mentions_step}\\b`).test(t))
      notes.push(`no cita el paso ${k.mentions_step}`);
    if (k.must_include_any && !k.must_include_any.some((w) => t.includes(plain(w))))
      notes.push(`no menciona ninguna de: ${k.must_include_any.join(", ")}`);
    if (k.no_markdown && /(\*\*|^#{1,3} )/m.test(text)) notes.push("usa markdown");
    if (k.conservative && !CONSERVATIVE.test(t))
      notes.push("no es conservadora con el vencimiento");
    for (const term of k.refuses ?? []) {
      const early = REFUSAL.test(t.slice(0, 220));
      const allNegated = sentences(t)
        .filter((s) => s.includes(plain(term)))
        .every((s) => NEGATIVE.test(s));
      if (!early && !allNegated) notes.push(`no rechaza ${term}`);
    }
    // En TODOS los casos: ningún ingrediente prohibido puede recomendarse.
    for (const f of PROFILE.forbidden) {
      const bad = sentences(t).filter(
        (s) => s.includes(plain(f)) && !NEGATIVE.test(s) && !REFUSAL.test(s),
      );
      if (bad.length) {
        forbiddenSuggestions++;
        notes.push(`sugiere ${f} (prohibido)`);
      }
    }
    if (notes.length && process.env.EVAL_VERBOSE)
      console.log(`\n--- ${c.id}: ${c.question}\n${text}\n`);
    rows.push({ id: c.id, ok: notes.length === 0, notes, tools, ms: Date.now() - t0 });
  }

  console.log(
    "\nCaso                          Res.    Tiempo   Tools                          Notas",
  );
  for (const r of rows) {
    console.log(
      `${r.id.padEnd(30)}${(r.ok ? "OK" : "FALLA").padEnd(8)}${String(r.ms + " ms").padEnd(9)}${(r.tools.join(",") || "-").padEnd(31)}${r.notes.join(" · ")}`,
    );
  }
  const passed = rows.filter((r) => r.ok).length;
  const pct = rows.length ? Math.round((passed / rows.length) * 100) : 0;
  console.log(
    `\n${passed}/${rows.length} casos pasan (${pct}%). Sugerencias con ingredientes prohibidos: ${forbiddenSuggestions}. Costo estimado: USD ${cost.toFixed(3)} (${calls} corridas).`,
  );
  if (pct < 90 || forbiddenSuggestions > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
