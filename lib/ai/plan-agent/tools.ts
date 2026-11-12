import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { nameKey } from "@/lib/domain/ingredient-match";
import { slotLabel, type MealSlot } from "@/lib/domain/meal-slots";
import type { PlanIssue } from "@/lib/domain/validate-plan";
import { addDays, dayLabel, weekDays } from "@/lib/domain/week";
import { checkRecipe } from "@/lib/domain/compatibility";
import { searchCatalog } from "@/lib/public/catalog";
import { saveRecipeWith } from "@/lib/recipes/save";
import { loadIngredientsForCheck } from "@/lib/recipes/compatibility";
import { getPlanEntries } from "@/lib/plan/queries";
import type { PlanEntry } from "@/lib/plan/types";
import type { Database } from "@/lib/supabase/database.types";
import type { PlanAgentEvent } from "./events";
import {
  loadDiets,
  loadMealRules,
  validateCandidates,
  type Candidate,
  type Client,
} from "./validation";

export type PlanToolCtx = {
  supabase: Client;
  userId: string;
  groupId: string;
  planId: string;
  weekStart: string;
  slots: MealSlot[];
  emit: (event: PlanAgentEvent) => void;
};
export type PlanToolOutput = { result: unknown; isError?: boolean };

type ToolDef<S extends z.ZodType> = {
  name: string;
  description: string;
  schema: S;
  run: (input: z.infer<S>, ctx: PlanToolCtx) => Promise<PlanToolOutput>;
};

const defineTool = <S extends z.ZodType>(t: ToolDef<S>) => t;

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const slotSchema = z.enum(["breakfast", "lunch", "merienda", "dinner", "snack"]);

const issueLines = (list: PlanIssue[]) => list.map((i) => `[${i.code}] ${i.message}`);

/** Resumen corto de lo que quedó en el plan, para el modelo. */
function summarize(entries: PlanEntry[]) {
  return entries.map((e) => ({
    id: e.id,
    date: e.date,
    day: dayLabel(e.date),
    slot: e.slot,
    recipe_id: e.recipe_id,
    title: e.recipe?.title ?? e.free_text,
    leftovers_of: e.leftovers_of_entry_id,
  }));
}

async function currentCandidates(ctx: PlanToolCtx): Promise<Candidate[]> {
  const { data } = await ctx.supabase
    .from("meal_plan_entries")
    .select(
      "id, date, slot, recipe_id, free_text, servings, diner_ids, cook_date, leftovers_of_entry_id, is_new_recipe",
    )
    .eq("plan_id", ctx.planId);
  return (data ?? []).map((r) => ({
    ...r,
    slot: r.slot as MealSlot,
    servings: r.servings === null ? null : Number(r.servings),
  }));
}

const checkWindow = (ctx: PlanToolCtx, candidates: Candidate[]): string | null => {
  const days = new Set(weekDays(ctx.weekStart));
  for (const c of candidates) {
    if (!days.has(c.date))
      return `La fecha ${c.date} no está en la semana del plan (${ctx.weekStart}).`;
    if (!ctx.slots.includes(c.slot))
      return `El momento "${slotLabel(c.slot)}" no está habilitado en este grupo.`;
    if (!c.recipe_id && !c.free_text) return "Cada comida necesita una receta o un texto libre.";
  }
  return null;
};

/** Valida y, si no hay errores, reemplaza las entradas indicadas. */
async function validateAndWrite(
  ctx: PlanToolCtx,
  next: Candidate[],
  write: () => Promise<string | null>,
  changedIds: string[],
): Promise<PlanToolOutput> {
  const windowError = checkWindow(ctx, next);
  if (windowError) return { result: { error: windowError }, isError: true };
  const v = await validateCandidates(ctx.supabase, ctx.groupId, next, ctx.weekStart);
  if (v.missingRecipeIds.length > 0) {
    return {
      result: {
        error: `Estas recetas no existen en el recetario: ${v.missingRecipeIds.join(", ")}`,
      },
      isError: true,
    };
  }
  if (v.errors.length > 0) {
    return {
      result: {
        applied: false,
        message:
          "No se guardó nada: hay comidas que no cumplen las restricciones. Corregilas y reintentá.",
        errors: issueLines(v.errors),
        warnings: issueLines(v.warnings),
      },
      isError: true,
    };
  }
  const failure = await write();
  if (failure) return { result: { error: failure }, isError: true };
  const entries = await getPlanEntries(ctx.planId, ctx.supabase);
  ctx.emit({ type: "plan_updated", entries, warnings: v.warnings, changedIds });
  return {
    result: { applied: true, entries: summarize(entries), warnings: issueLines(v.warnings) },
  };
}

/**
 * Los ids de recetas del catálogo se pueden usar directo en set_plan / update_entries: si no son del grupo,
 * se guardan en el recetario (copia editable) y se reemplazan por el id nuevo. Ahorra una vuelta por receta.
 */
async function adoptCatalogIds(
  ctx: PlanToolCtx,
  ids: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((i): i is string => Boolean(i)))];
  const map = new Map<string, string>();
  if (wanted.length === 0) return map;
  const { data: own } = await ctx.supabase
    .from("recipes")
    .select("id")
    .eq("group_id", ctx.groupId)
    .in("id", wanted);
  const ownIds = new Set((own ?? []).map((r) => r.id));
  await Promise.all(
    wanted
      .filter((id) => !ownIds.has(id))
      .map(async (id) => {
        const { data } = await ctx.supabase.rpc("fork_published_recipe", {
          p_recipe_id: id,
          p_target_group_id: ctx.groupId,
        });
        if (data) map.set(id, data);
      }),
  );
  return map;
}

const entryInput = z.object({
  date,
  slot: slotSchema,
  recipe_id: uuid.nullish(),
  free_text: z.string().trim().max(200).nullish(),
  servings: z.number().positive().nullish(),
  diner_ids: z.array(uuid).default([]),
  cook_date: date.nullish(),
  /** Sobras de otra comida de este mismo plan, identificada por su día y momento. */
  leftovers_of: z.object({ date, slot: slotSchema }).nullish(),
});

const searchRecipes = defineTool({
  name: "search_recipes",
  description:
    "Busca recetas del recetario del grupo (hasta 20). Devuelve id, título, minutos, tags y, si pasás for_user_ids, si son compatibles con esas personas.",
  schema: z.object({
    query: z.string().max(100).optional(),
    tags: z.array(z.string().max(40)).max(10).optional(),
    max_minutes: z.number().int().positive().optional(),
    exclude_ids: z.array(uuid).max(50).optional(),
    for_user_ids: z.array(uuid).max(20).optional(),
  }),
  async run(input, ctx) {
    let q = ctx.supabase
      .from("recipes")
      .select("id, title, total_minutes, tags, servings")
      .eq("group_id", ctx.groupId)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(60);
    if (input.query) q = q.ilike("title", `%${input.query.replace(/[%_]/g, " ")}%`);
    if (input.tags?.length) q = q.overlaps("tags", input.tags);
    if (input.max_minutes) q = q.lte("total_minutes", input.max_minutes);
    if (input.exclude_ids?.length) q = q.not("id", "in", `(${input.exclude_ids.join(",")})`);
    const { data } = await q;
    const rows = data ?? [];

    // Las incompatibles con las personas indicadas no se ofrecen (el chequeo es por código).
    const diets = (await loadDiets(ctx.supabase, ctx.groupId)).filter(
      (d) => !input.for_user_ids?.length || input.for_user_ids.includes(d.userId),
    );
    const ingredients = await loadIngredientsForCheck(
      rows.map((r) => r.id),
      ctx.supabase,
    );
    const results = rows
      .map((r) => {
        const checks = (ingredients.get(r.id) ?? []).map((i) => i.check);
        const statuses = diets.map((d) => checkRecipe(checks, d.restrictions).status);
        return {
          id: r.id,
          title: r.title,
          total_minutes: r.total_minutes,
          tags: r.tags,
          servings: Number(r.servings),
          compatibility: statuses.includes("forbidden")
            ? "forbidden"
            : statuses.includes("limit")
              ? "limit"
              : "ok",
        };
      })
      .filter((r) => r.compatibility !== "forbidden")
      .slice(0, 20);
    return { result: { count: results.length, recipes: results } };
  },
});

const getRecentMeals = defineTool({
  name: "get_recent_meals",
  description: "Qué comió el grupo en las últimas semanas (para no repetir).",
  schema: z.object({ weeks: z.number().int().min(1).max(8).default(2) }),
  async run({ weeks }, ctx) {
    const from = addDays(ctx.weekStart, -7 * weeks);
    const { data } = await ctx.supabase
      .from("meal_plan_entries")
      .select(
        "date, slot, free_text, recipes(title), meal_plans!inner(group_id, week_start, status)",
      )
      .eq("meal_plans.group_id", ctx.groupId)
      .neq("meal_plans.status", "archived")
      .gte("date", from)
      .lt("date", ctx.weekStart)
      .order("date");
    return {
      result: {
        meals: (data ?? []).map((m) => ({
          date: m.date,
          slot: m.slot,
          title: m.recipes?.title ?? m.free_text,
        })),
      },
    };
  },
});

const getParticipants = defineTool({
  name: "get_participants",
  description:
    "Miembros del grupo con sus restricciones alimentarias. Los ids sirven para diner_ids y for_user_ids.",
  schema: z.object({}),
  async run(_input, ctx) {
    const diets = await loadDiets(ctx.supabase, ctx.groupId);
    const mealRules = await loadMealRules(ctx.supabase, ctx.groupId);
    const { data: members } = await ctx.supabase
      .from("group_members")
      .select("user_id, profiles(display_name)")
      .eq("group_id", ctx.groupId);
    return {
      result: {
        members: (members ?? []).map((m) => {
          const diet = diets.find((d) => d.userId === m.user_id);
          return {
            id: m.user_id,
            name: m.profiles?.display_name ?? "Alguien",
            meal_rules: mealRules
              .filter((r) => r.userId === m.user_id)
              .map((r) => ({ slot: r.slot, days: r.days, formula: r.formula })),
            restrictions: (diet?.restrictions ?? []).map((r) => ({
              target: r.target,
              type: r.type,
              severity: r.severity,
              limit: r.limit,
            })),
          };
        }),
        enabled_slots: ctx.slots,
      },
    };
  },
});

const getIngredientInfo = defineTool({
  name: "get_ingredient_info",
  description: "Vida útil, sección del súper y familia de ingredientes del catálogo.",
  schema: z.object({ names: z.array(z.string().max(80)).min(1).max(15) }),
  async run({ names }, ctx) {
    const { data } = await ctx.supabase
      .from("ingredients")
      .select("name, aliases, family, aisle, shelf_life");
    const keys = names.map(nameKey);
    const found = (data ?? []).filter((i) =>
      [i.name, ...(i.aliases ?? [])].some((n) => keys.includes(nameKey(n))),
    );
    return {
      result: {
        ingredients: found.map((i) => ({
          name: i.name,
          families: i.family,
          aisle: i.aisle,
          shelf_life_days: i.shelf_life,
        })),
        not_found: keys.filter(
          (k) => !found.some((i) => [i.name, ...(i.aliases ?? [])].some((n) => nameKey(n) === k)),
        ),
      },
    };
  },
});

const proposeRecipe = defineTool({
  name: "propose_recipe",
  description:
    "Crea una receta nueva como BORRADOR (la persona la revisa antes de aceptarla). Devuelve su id para usarla en el plan.",
  schema: z.object({
    recipe: z.object({
      title: z.string().trim().min(1).max(120),
      description: z.string().max(500).optional(),
      servings: z.number().positive().default(4),
      total_minutes: z.number().int().positive().optional(),
      tags: z.array(z.string().max(40)).max(10).default([]),
      ingredients: z.array(z.string().trim().min(1).max(200)).min(1).max(40),
      steps: z.array(z.string().trim().min(1).max(1000)).min(1).max(30),
    }),
  }),
  async run({ recipe }, ctx) {
    const saved = await saveRecipeWith(ctx.supabase, {
      group_id: ctx.groupId,
      title: recipe.title,
      description: recipe.description ?? null,
      servings: recipe.servings,
      total_minutes: recipe.total_minutes ?? null,
      tags: recipe.tags,
      source_type: "ai_generated",
      ingredients: recipe.ingredients.map((raw_text, position) => ({
        raw_text,
        position,
        optional: false,
      })),
      steps: recipe.steps.map((instruction, position) => ({ instruction, position })),
    });
    if (!saved.ok) return { result: { error: saved.error }, isError: true };
    const { error } = await ctx.supabase
      .from("recipes")
      .update({ status: "draft", draft_for_plan_id: ctx.planId })
      .eq("id", saved.data.id);
    if (error) return { result: { error: "No se pudo guardar el borrador." }, isError: true };
    return { result: { recipe_id: saved.data.id, title: recipe.title, status: "draft" } };
  },
});

const setPlan = defineTool({
  name: "set_plan",
  description:
    "Escribe el plan completo de la semana (reemplaza todas las comidas actuales). Valida restricciones: si hay errores no se guarda nada.",
  schema: z.object({ entries: z.array(entryInput).min(1).max(60) }),
  async run({ entries }, ctx) {
    const adopted = await adoptCatalogIds(
      ctx,
      entries.map((e) => e.recipe_id),
    );
    const ids: string[] = entries.map(() => randomUUID());
    const keyOf = (d: string, s: string) => `${d}|${s}`;
    const byKey = new Map(entries.map((e, i) => [keyOf(e.date, e.slot), ids[i]]));
    const next: Candidate[] = entries.map((e, i) => ({
      id: ids[i]!,
      date: e.date,
      slot: e.slot,
      recipe_id: e.recipe_id ? (adopted.get(e.recipe_id) ?? e.recipe_id) : null,
      free_text: e.recipe_id ? null : (e.free_text ?? null),
      servings: e.servings ?? null,
      diner_ids: e.diner_ids,
      cook_date: e.cook_date ?? null,
      leftovers_of_entry_id: e.leftovers_of
        ? (byKey.get(keyOf(e.leftovers_of.date, e.leftovers_of.slot)) ?? null)
        : null,
      is_new_recipe: false,
    }));
    return validateAndWrite(
      ctx,
      next,
      async () => {
        const del = await ctx.supabase.from("meal_plan_entries").delete().eq("plan_id", ctx.planId);
        if (del.error) return "No se pudo reemplazar el plan.";
        const rows = next.map((c, position) => ({
          ...c,
          plan_id: ctx.planId,
          position,
        })) satisfies Database["public"]["Tables"]["meal_plan_entries"]["Insert"][];
        const ins = await ctx.supabase.from("meal_plan_entries").insert(rows);
        return ins.error ? "No se pudieron guardar las comidas." : null;
      },
      ids,
    );
  },
});

const updateEntries = defineTool({
  name: "update_entries",
  description:
    "Cambia, agrega o quita comidas puntuales. Con entry_id modifica esa comida; sin entry_id agrega una (date + slot). remove=true la borra. Valida restricciones.",
  schema: z.object({
    changes: z
      .array(
        z.object({
          entry_id: uuid.optional(),
          date: date.optional(),
          slot: slotSchema.optional(),
          recipe_id: uuid.nullish(),
          free_text: z.string().trim().max(200).nullish(),
          servings: z.number().positive().nullish(),
          diner_ids: z.array(uuid).optional(),
          remove: z.boolean().optional(),
        }),
      )
      .min(1)
      .max(30),
  }),
  async run({ changes }, ctx) {
    const adopted = await adoptCatalogIds(
      ctx,
      changes.map((c) => c.recipe_id),
    );
    for (const ch of changes)
      if (ch.recipe_id && adopted.has(ch.recipe_id)) ch.recipe_id = adopted.get(ch.recipe_id)!;
    const current = await currentCandidates(ctx);
    let next = [...current];
    const changedIds: string[] = [];
    const removed: string[] = [];
    const added: Candidate[] = [];
    const modified = new Map<string, Candidate>();

    for (const ch of changes) {
      if (ch.entry_id) {
        const base = modified.get(ch.entry_id) ?? current.find((c) => c.id === ch.entry_id);
        if (!base)
          return { result: { error: `No existe la comida ${ch.entry_id}.` }, isError: true };
        if (ch.remove) {
          removed.push(base.id);
          next = next.filter((c) => c.id !== base.id);
          continue;
        }
        const recipe_id = ch.recipe_id === undefined ? base.recipe_id : ch.recipe_id;
        const updated: Candidate = {
          ...base,
          date: ch.date ?? base.date,
          slot: ch.slot ?? base.slot,
          recipe_id,
          free_text: recipe_id ? null : ch.free_text === undefined ? base.free_text : ch.free_text,
          servings: ch.servings === undefined ? base.servings : ch.servings,
          diner_ids: ch.diner_ids ?? base.diner_ids,
        };
        modified.set(base.id, updated);
        next = next.map((c) => (c.id === base.id ? updated : c));
        changedIds.push(base.id);
      } else {
        if (!ch.date || !ch.slot)
          return {
            result: { error: "Para agregar una comida necesitás date y slot." },
            isError: true,
          };
        const created: Candidate = {
          id: randomUUID(),
          date: ch.date,
          slot: ch.slot,
          recipe_id: ch.recipe_id ?? null,
          free_text: ch.recipe_id ? null : (ch.free_text ?? null),
          servings: ch.servings ?? null,
          diner_ids: ch.diner_ids ?? [],
          cook_date: null,
          leftovers_of_entry_id: null,
          is_new_recipe: false,
        };
        added.push(created);
        next.push(created);
        changedIds.push(created.id);
      }
    }
    // Las sobras que apuntaban a una comida borrada pierden la referencia.
    next = next.map((c) =>
      c.leftovers_of_entry_id && removed.includes(c.leftovers_of_entry_id)
        ? { ...c, leftovers_of_entry_id: null }
        : c,
    );

    return validateAndWrite(
      ctx,
      next,
      async () => {
        if (removed.length > 0) {
          const del = await ctx.supabase.from("meal_plan_entries").delete().in("id", removed);
          if (del.error) return "No se pudo quitar una comida.";
        }
        for (const m of modified.values()) {
          const { id, ...rest } = m;
          const upd = await ctx.supabase.from("meal_plan_entries").update(rest).eq("id", id);
          if (upd.error) return "No se pudo cambiar una comida.";
        }
        if (added.length > 0) {
          const ins = await ctx.supabase
            .from("meal_plan_entries")
            .insert(added.map((c, i) => ({ ...c, plan_id: ctx.planId, position: 100 + i })));
          if (ins.error) return "No se pudo agregar una comida.";
        }
        return null;
      },
      changedIds,
    );
  },
});

const searchCatalogTool = defineTool({
  name: "search_catalog",
  description:
    "Busca en el CATÁLOGO público de recetas (miles de recetas rápidas) cuando el recetario del grupo no alcanza. Las prohibidas por las restricciones del grupo ya vienen filtradas. Para usar una, llamá después a use_catalog_recipe.",
  schema: z.object({
    query: z.string().max(100).optional(),
    tag: z.string().max(40).optional(),
    max_minutes: z.number().int().positive().optional(),
  }),
  async run(input, ctx) {
    const diets = await loadDiets(ctx.supabase, ctx.groupId);
    const hits = await searchCatalog(ctx.supabase, {
      q: input.query,
      tag: input.tag,
      maxMinutes: input.max_minutes,
      limit: 12,
      diets,
    });
    return {
      result: {
        count: hits.length,
        recipes: hits.map((h) => ({
          id: h.id,
          title: h.title,
          total_minutes: h.total_minutes,
          tags: h.tags,
          main_ingredients: h.ingredients.slice(0, 6).map((i) => i.name),
        })),
      },
    };
  },
});

const useCatalogRecipe = defineTool({
  name: "use_catalog_recipe",
  description:
    "Guarda una receta del catálogo en el recetario del grupo (copia editable) y devuelve su id nuevo para usar en set_plan / update_entries.",
  schema: z.object({ recipe_id: uuid }),
  async run({ recipe_id }, ctx) {
    const { data, error } = await ctx.supabase.rpc("fork_published_recipe", {
      p_recipe_id: recipe_id,
      p_target_group_id: ctx.groupId,
    });
    if (error || !data)
      return { result: { error: "No se pudo guardar esa receta del catálogo." }, isError: true };
    const { data: r } = await ctx.supabase
      .from("recipes")
      .select("title")
      .eq("id", data)
      .maybeSingle();
    return { result: { recipe_id: data, title: r?.title ?? null, saved_to_group: true } };
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PLAN_TOOLS: ToolDef<any>[] = [
  searchRecipes,
  searchCatalogTool,
  useCatalogRecipe,
  getRecentMeals,
  getParticipants,
  getIngredientInfo,
  proposeRecipe,
  setPlan,
  updateEntries,
];

export function planToolDefinitions(): Anthropic.Messages.Tool[] {
  return PLAN_TOOLS.map((t) => {
    const { $schema: _ignored, ...input_schema } = z.toJSONSchema(t.schema) as Record<
      string,
      unknown
    >;
    void _ignored;
    return {
      name: t.name,
      description: t.description,
      input_schema: input_schema as Anthropic.Messages.Tool.InputSchema,
    };
  });
}

export async function runPlanTool(
  name: string,
  input: unknown,
  ctx: PlanToolCtx,
): Promise<PlanToolOutput> {
  const tool = PLAN_TOOLS.find((t) => t.name === name);
  if (!tool) return { result: { error: `Herramienta desconocida: ${name}` }, isError: true };
  const parsed = tool.schema.safeParse(input);
  if (!parsed.success) {
    return {
      result: {
        error: `Entrada inválida: ${parsed.error.issues.map((i: { path: PropertyKey[]; message: string }) => `${i.path.map(String).join(".")}: ${i.message}`).join("; ")}`,
      },
      isError: true,
    };
  }
  return tool.run(parsed.data, ctx);
}
