import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MODELS } from "@/lib/ai/models";
import { loadDiets, loadMealRules } from "@/lib/ai/plan-agent/validation";
import { describeDiets } from "@/lib/ai/recipes/adapt";
import { runStructured } from "@/lib/ai/run-structured";
import { checkRecipe, type RecipeIngredientForCheck } from "@/lib/domain/compatibility";
import { computeCoverage, coverageLabel, type Coverage } from "@/lib/domain/coverage";
import { parseIngredientLine } from "@/lib/domain/ingredient-line";
import { mismatchedGroups, rulesFor } from "@/lib/domain/meal-rules";
import { dayOfWeek, daysBetween } from "@/lib/domain/week";
import { pickIdeas, type RecipeSignal } from "@/lib/suggest/signals";
import { loadIngredientsForCheck } from "@/lib/recipes/compatibility";
import { saveRecipeWith } from "@/lib/recipes/save";
import {
  newRecipesSchema,
  rankedSchema,
  type SuggestCard,
  type SuggestFilters,
} from "@/lib/schemas/suggest";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export type Candidate = {
  id: string;
  title: string;
  imageUrl: string | null;
  totalMinutes: number | null;
  servings: number;
  tags: string[];
  usesOven: boolean;
  ingredients: (RecipeIngredientForCheck & { optional: boolean })[];
};

/** Recetas activas del grupo con lo que hace falta para chequear compatibilidad y cobertura. */
export async function loadCandidates(supabase: Client, groupId: string): Promise<Candidate[]> {
  const { data } = await supabase
    .from("recipes")
    .select(
      "id, title, image_url, total_minutes, servings, tags, recipe_ingredients(raw_text, ingredient_id, optional, position, ingredients(name, aliases, family)), recipe_steps(instruction)",
    )
    .eq("group_id", groupId)
    .eq("status", "active")
    .is("deleted_at", null)
    .limit(300);
  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    imageUrl: r.image_url,
    totalMinutes: r.total_minutes,
    servings: Number(r.servings),
    tags: r.tags ?? [],
    usesOven:
      (r.recipe_steps ?? []).some((s) => /\bhorno\b/i.test(s.instruction)) ||
      /horno/i.test(r.title),
    ingredients: [...(r.recipe_ingredients ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((ri) => ({
        ingredientId: ri.ingredient_id,
        name:
          ri.ingredients?.name ??
          (parseIngredientLine(ri.raw_text ?? "").name || ri.raw_text || ""),
        aliases: ri.ingredients?.aliases ?? [],
        families: ri.ingredients?.family ?? [],
        optional: ri.optional,
      })),
  }));
}

export function applyFilters(list: Candidate[], filters: SuggestFilters): Candidate[] {
  return list.filter((c) => {
    if (filters.quick && !(c.totalMinutes !== null && c.totalMinutes <= 30)) return false;
    if (filters.noOven && c.usesOven) return false;
    if (filters.light && !c.tags.some((t) => t.toLowerCase() === "liviano")) return false;
    return true;
  });
}

type Scored = { c: Candidate; cov: Coverage };

const MAX_RESULTS = 5;
const STRONG = 0.7;

const wordsOf = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z]+/)
    .filter((w) => w.length > 2);

/** Quedan primero las que se pueden hacer con lo que hay; el antojo desempata. */
export function rank(list: Candidate[], have: string[], craving?: string): Scored[] {
  const cravingWords = craving ? wordsOf(craving) : [];
  const bonus = (c: Candidate) => {
    if (cravingWords.length === 0) return 0;
    const hay = wordsOf(`${c.title} ${c.ingredients.map((i) => i.name).join(" ")}`);
    return cravingWords.some((w) => hay.some((h) => h.startsWith(w.slice(0, 5)))) ? 0.15 : 0;
  };
  return list
    .map((c) => ({ c, cov: computeCoverage(have, c.ingredients) }))
    .sort(
      (a, b) =>
        b.cov.score + bonus(b.c) - (a.cov.score + bonus(a.c)) ||
        (a.c.totalMinutes ?? 999) - (b.c.totalMinutes ?? 999),
    );
}

const RANK_SYSTEM = `Sos el asistente de cocina de una app familiar argentina. Te paso recetas del recetario con lo que la persona tiene en casa. Devolvé las recetas en el orden en que conviene sugerirlas y una línea corta (máximo 14 palabras, voseo, sin markdown) por receta que diga por qué sirve hoy. No inventes ingredientes ni datos.`;

const NEW_SYSTEM = `Sos un cocinero argentino creativo. Proponé recetas NUEVAS, simples y rápidas, usando sobre todo lo que la persona tiene en casa (podés sumar básicos de alacena: sal, aceite, pimienta). Cada ingrediente en una línea con cantidad ("2 zapallitos", "300 g de pollo"). Respetá estrictamente las restricciones alimentarias que te paso: nunca uses un ingrediente prohibido. Pasos claros, en voseo. Una línea final corta de por qué conviene hoy.`;

/** ¿La receta encaja con la fórmula del momento para todas las personas con plan vivo? */
export function fitsMealRules(
  c: Candidate,
  rules: Awaited<ReturnType<typeof loadMealRules>>,
  slot: string,
  date: string,
): boolean {
  return rulesFor(rules, slot, date, dayOfWeek).every(
    (rule) => mismatchedGroups(rule, c.ingredients).length === 0,
  );
}

export type PantryInput = {
  supabase: Client;
  userId: string;
  groupId: string;
  have: string[];
  craving?: string;
  filters: SuggestFilters;
  /** Momento y fecha de la comida, para respetar la fórmula del plan vivo. */
  slot?: string;
  date?: string;
};

/** "¿Qué tenés?": recetas del recetario por cobertura (aptas para todos) y, si no alcanzan, 1–2 nuevas en borrador. */
export async function suggestFromPantry(
  input: PantryInput,
): Promise<{ ok: true; cards: SuggestCard[] } | { ok: false; error: string }> {
  const { supabase, groupId, have } = input;
  const [all, diets] = await Promise.all([
    loadCandidates(supabase, groupId),
    loadDiets(supabase, groupId),
  ]);

  const rules = input.slot && input.date ? await loadMealRules(supabase, groupId) : [];
  const allowed = applyFilters(all, input.filters).filter(
    (c) =>
      !diets.some((d) => checkRecipe(c.ingredients, d.restrictions).status === "forbidden") &&
      (!input.slot || !input.date || fitsMealRules(c, rules, input.slot, input.date)),
  );
  const scored = rank(allowed, have, input.craving)
    .filter((s) => s.cov.score >= 0.4)
    .slice(0, MAX_RESULTS);

  const cards = new Map<string, SuggestCard>();
  const toCard = (s: Scored, line: string): SuggestCard => ({
    recipeId: s.c.id,
    title: s.c.title,
    imageUrl: s.c.imageUrl,
    totalMinutes: s.c.totalMinutes,
    line,
    label: coverageLabel(s.cov),
    missing: s.cov.missing,
    isNew: false,
  });

  if (scored.length > 0) {
    const ai = await runStructured({
      feature: "ideas",
      model: MODELS.fast,
      system: RANK_SYSTEM,
      content: `Tiene en casa: ${have.join(", ") || "(no dijo)"}.\nAntojo: ${input.craving || "(ninguno)"}.\nRecetas:\n${scored
        .map(
          (s) =>
            `- id ${s.c.id}: ${s.c.title} (${s.c.totalMinutes ?? "?"} min). ${coverageLabel(s.cov)}`,
        )
        .join("\n")}`,
      schema: rankedSchema,
      userId: input.userId,
      groupId,
      maxTokens: 800,
    });
    const lines = new Map(ai.ok ? ai.data.items.map((i) => [i.id, i.line]) : []);
    const order = ai.ok ? ai.data.items.map((i) => i.id) : [];
    const byId = new Map(scored.map((s) => [s.c.id, s]));
    const ordered = [
      ...order.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])),
      ...scored.filter((s) => !order.includes(s.c.id)),
    ];
    for (const s of ordered)
      cards.set(s.c.id, toCard(s, lines.get(s.c.id) ?? coverageLabel(s.cov)));
  }

  // Si casi nada se puede hacer con lo que hay, la IA propone 1–2 recetas nuevas (borrador).
  const strong = [...cards.values()].filter(
    (c) => c.missing.length === 0 || scoreOf(scored, c.recipeId) >= STRONG,
  );
  if (strong.length < 2 && have.length > 0) {
    const created = await proposeNew(input, diets, 2 - strong.length);
    for (const card of created) cards.set(card.recipeId, card);
  }

  return { ok: true, cards: [...cards.values()] };
}

const scoreOf = (scored: Scored[], id: string) => scored.find((s) => s.c.id === id)?.cov.score ?? 0;

export async function proposeNew(
  input: PantryInput,
  diets: Awaited<ReturnType<typeof loadDiets>>,
  count: number,
): Promise<SuggestCard[]> {
  const { supabase, groupId } = input;
  const run = await runStructured({
    feature: "ideas",
    model: MODELS.fast,
    system: NEW_SYSTEM,
    content: `Tiene en casa: ${input.have.join(", ") || "(no dijo: proponé algo rico y simple para hoy)"}.\nAntojo: ${input.craving || "(ninguno)"}.\nRestricciones:\n${describeDiets(diets)}\nProponé ${count} receta${count > 1 ? "s" : ""}.`,
    schema: newRecipesSchema,
    userId: input.userId,
    groupId,
    maxTokens: 2500,
  });
  if (!run.ok) return [];

  const out: SuggestCard[] = [];
  for (const r of run.data.recipes.slice(0, count)) {
    const saved = await saveRecipeWith(supabase, {
      group_id: groupId,
      title: r.title,
      servings: 4,
      total_minutes: r.total_minutes,
      source_type: "ai_generated",
      ingredients: r.ingredients.map((raw_text, position) => ({
        raw_text,
        position,
        optional: false,
      })),
      steps: r.steps.map((instruction, position) => ({ instruction, position })),
    });
    if (!saved.ok) continue;
    await supabase.from("recipes").update({ status: "draft" }).eq("id", saved.data.id);

    // Las restricciones se validan por código: si el modelo se coló, se descarta.
    const checks =
      (await loadIngredientsForCheck([saved.data.id], supabase)).get(saved.data.id) ?? [];
    const forbidden = diets.some(
      (d) =>
        checkRecipe(
          checks.map((c) => c.check),
          d.restrictions,
        ).status === "forbidden",
    );
    if (forbidden) {
      await supabase.from("recipes").delete().eq("id", saved.data.id);
      continue;
    }
    const cov = computeCoverage(
      input.have,
      checks.map((c) => ({ ...c.check, optional: c.check.optional })),
    );
    out.push({
      recipeId: saved.data.id,
      title: r.title,
      imageUrl: null,
      totalMinutes: r.total_minutes,
      line: r.line,
      label: coverageLabel(cov),
      missing: cov.missing,
      isNew: true,
    });
  }
  return out;
}

export type IdeasInput = {
  supabase: Client;
  userId: string;
  groupId: string;
  tab: "library" | "new";
  exclude: string[];
  hour: number;
  today: string;
  slot?: string;
};

/** Hasta 3 ideas para hoy, cada una con su motivo. "Del recetario" usa señales por código; "Nuevas" las inventa la IA. */
export async function suggestIdeas(
  input: IdeasInput,
): Promise<{ ok: true; cards: SuggestCard[] } | { ok: false; error: string }> {
  const { supabase, groupId } = input;
  const diets = await loadDiets(supabase, groupId);

  if (input.tab === "new") {
    const cards = await proposeNew(
      {
        supabase,
        userId: input.userId,
        groupId,
        have: [],
        filters: { quick: false, noOven: false, light: false },
      },
      diets,
      3,
    );
    return { ok: true, cards: cards.map((c) => ({ ...c, reason: c.line })) };
  }

  const all = await loadCandidates(supabase, groupId);
  const slot = input.slot ?? (input.hour < 15 ? "lunch" : "dinner");
  const rules = await loadMealRules(supabase, groupId);
  const allowed = all.filter(
    (c) =>
      !diets.some((d) => checkRecipe(c.ingredients, d.restrictions).status === "forbidden") &&
      fitsMealRules(c, rules, slot, input.today),
  );

  // Última vez que se cocinó cada receta (según los planes del grupo).
  const { data: past } = await supabase
    .from("meal_plan_entries")
    .select("recipe_id, date, meal_plans!inner(group_id)")
    .eq("meal_plans.group_id", groupId)
    .not("recipe_id", "is", null)
    .lte("date", input.today);
  const last = new Map<string, string>();
  for (const e of past ?? []) {
    if (!e.recipe_id) continue;
    const prev = last.get(e.recipe_id);
    if (!prev || e.date > prev) last.set(e.recipe_id, e.date);
  }
  const { count } = await supabase
    .from("group_members")
    .select("user_id", { count: "exact", head: true })
    .eq("group_id", groupId);

  const signals: RecipeSignal[] = allowed.map((c) => {
    const date = last.get(c.id);
    return {
      recipeId: c.id,
      daysSinceCooked: date ? daysBetween(date, input.today) : null,
      servings: c.servings,
      totalMinutes: c.totalMinutes,
    };
  });
  const picked = pickIdeas(
    signals,
    { hour: input.hour, diners: count ?? diets.length },
    input.exclude,
    3,
  );
  const byId = new Map(allowed.map((c) => [c.id, c]));
  const cards: SuggestCard[] = picked.flatMap((p) => {
    const c = byId.get(p.recipeId);
    return c
      ? [
          {
            recipeId: c.id,
            title: c.title,
            imageUrl: c.imageUrl,
            totalMinutes: c.totalMinutes,
            line: p.reason,
            reason: p.reason,
            label: "De tu recetario",
            missing: [],
            isNew: false,
          },
        ]
      : [];
  });
  return { ok: true, cards };
}
