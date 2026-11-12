import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { applyCookingEdits, summarizeEdits } from "@/lib/domain/apply-cooking-edits";
import { matchLocal, normalizeName, type CatalogIngredient } from "@/lib/domain/ingredient-match";
import { cookingEditsSchema } from "@/lib/schemas/cooking-edits";
import type { Database } from "@/lib/supabase/database.types";
import type { Proposal } from "./events";

export type ToolCtx = { supabase: SupabaseClient<Database>; userId: string; groupId: string };
export type ToolOutput = { result: unknown; proposal?: Proposal };

type ToolDef<S extends z.ZodType> = {
  name: string;
  description: string;
  schema: S;
  run: (input: z.infer<S>, ctx: ToolCtx) => Promise<ToolOutput>;
};

const RECIPE_COLUMNS =
  "id, title, servings, total_minutes, tags, recipe_ingredients(id, ingredient_id, raw_text, quantity, unit, preparation, section, optional, position), recipe_steps(id, position, instruction, duration_seconds, timer_kind, tip, ingredient_ids)";

async function loadRecipe(ctx: ToolCtx, recipeId: string) {
  const { data } = await ctx.supabase
    .from("recipes")
    .select(RECIPE_COLUMNS)
    .eq("id", recipeId)
    .eq("group_id", ctx.groupId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  return {
    ...data,
    ingredients: [...(data.recipe_ingredients ?? [])].sort((a, b) => a.position - b.position),
    steps: [...(data.recipe_steps ?? [])].sort((a, b) => a.position - b.position),
  };
}

const uuid = z.string().uuid();

const getRecipe = {
  name: "get_recipe",
  description: "Trae una receta del recetario del grupo con sus ingredientes y pasos.",
  schema: z.object({ recipe_id: uuid }),
  async run({ recipe_id }, ctx) {
    const r = await loadRecipe(ctx, recipe_id);
    if (!r) return { result: { error: "No encontré esa receta en el recetario." } };
    return {
      result: {
        id: r.id,
        title: r.title,
        servings: r.servings,
        total_minutes: r.total_minutes,
        tags: r.tags,
        ingredients: r.ingredients.map((i) => i.raw_text),
        steps: r.steps.map((s, i) => ({
          n: i + 1,
          instruction: s.instruction,
          duration_seconds: s.duration_seconds,
        })),
      },
    };
  },
} satisfies ToolDef<z.ZodObject<{ recipe_id: z.ZodString }>>;

const searchRecipes = {
  name: "search_recipes",
  description: "Busca recetas del recetario del grupo por nombre o ingrediente.",
  schema: z.object({ query: z.string().min(1).max(100) }),
  async run({ query }, ctx) {
    const { data } = await ctx.supabase
      .from("recipes")
      .select("id, title, total_minutes, tags")
      .eq("group_id", ctx.groupId)
      .is("deleted_at", null)
      .textSearch("search_tsv", query, { config: "spanish_unaccent", type: "websearch" })
      .limit(8);
    return { result: { recipes: data ?? [] } };
  },
} satisfies ToolDef<z.ZodObject<{ query: z.ZodString }>>;

const getIngredientInfo = {
  name: "get_ingredient_info",
  description:
    "Datos del catálogo de ingredientes: vida útil (días en alacena/heladera/freezer), consejos de conservación, familia y sección del súper.",
  schema: z.object({ names: z.array(z.string().min(1).max(80)).min(1).max(8) }),
  async run({ names }, ctx) {
    const { data } = await ctx.supabase
      .from("ingredients")
      .select("id, name, aliases, family, aisle, default_unit, shelf_life, storage_tips");
    const catalog = (data ?? []) as (CatalogIngredient & Record<string, unknown>)[];
    const found = names.map((name) => {
      const match = matchLocal(
        name,
        catalog.map((c) => ({ id: c.id, name: c.name, aliases: c.aliases ?? [] })),
      );
      const row = match ? catalog.find((c) => c.id === match.id) : undefined;
      if (!row)
        return {
          query: name,
          found: false,
          note: "No está en el catálogo: usá criterio general y sé conservador.",
        };
      return {
        query: name,
        found: true,
        name: row.name,
        family: row.family,
        aisle: row.aisle,
        shelf_life: row.shelf_life,
        storage_tips: row.storage_tips,
      };
    });
    return { result: { ingredients: found } };
  },
} satisfies ToolDef<z.ZodObject<{ names: z.ZodArray<z.ZodString> }>>;

const checkCompatibility = {
  name: "check_compatibility",
  description:
    "Chequea si agregar o cambiar ingredientes en una receta es compatible con las restricciones alimentarias de la persona. Llamala SIEMPRE antes de recomendar sumar un ingrediente.",
  schema: z.object({
    recipe_id: uuid,
    changes: z.array(z.string().min(1).max(100)).min(1).max(10),
  }),
  async run({ changes }) {
    // El perfil alimentario llega en la Etapa 6 (T6.5); hasta entonces no hay restricciones cargadas.
    return {
      result: {
        status: "sin_perfil",
        message:
          "La persona todavía no cargó su perfil alimentario: no hay restricciones registradas.",
        checked: changes,
      },
    };
  },
} satisfies ToolDef<z.ZodObject<{ recipe_id: z.ZodString; changes: z.ZodArray<z.ZodString> }>>;

const proposeRecipeChange = {
  name: "propose_recipe_change",
  description:
    "Propone un cambio a una receta (la persona lo confirma antes de guardarlo). Operaciones: edit_text, set_duration, set_ingredient_qty, add_step_after, delete_step; los índices de paso empiezan en 0 y los de ingrediente son la posición en la lista.",
  schema: z.object({
    recipe_id: uuid,
    change_note: z.string().min(1).max(200),
    ops: cookingEditsSchema.min(1),
  }),
  async run({ recipe_id, change_note, ops }, ctx) {
    const r = await loadRecipe(ctx, recipe_id);
    if (!r) return { result: { error: "No encontré esa receta." } };
    const base = { ingredients: r.ingredients, steps: r.steps };
    const summary = summarizeEdits(base, ops);
    if (summary.length === 0)
      return {
        result: { error: "Esos cambios no se pueden aplicar a la receta: revisá los índices." },
      };
    // Valida que el resultado siga siendo una receta válida.
    if (applyCookingEdits(base, ops).steps.length === 0)
      return { result: { error: "La receta no puede quedar sin pasos." } };
    return {
      result: {
        status: "propuesta_lista",
        summary,
        note: "La persona va a ver una tarjeta para confirmar.",
      },
      proposal: {
        kind: "recipe_change",
        recipeId: r.id,
        recipeTitle: r.title,
        changeNote: change_note,
        ops,
        summary,
      },
    };
  },
} satisfies ToolDef<
  z.ZodObject<{
    recipe_id: z.ZodString;
    change_note: z.ZodString;
    ops: z.ZodArray<typeof cookingEditsSchema.element>;
  }>
>;

const proposeNote = {
  name: "propose_note",
  description:
    "Propone anotar una aclaración en una receta (sin cambiar sus ingredientes ni pasos). La persona confirma.",
  schema: z.object({ recipe_id: uuid, text: z.string().min(1).max(400) }),
  async run({ recipe_id, text }, ctx) {
    const r = await loadRecipe(ctx, recipe_id);
    if (!r) return { result: { error: "No encontré esa receta." } };
    return {
      result: { status: "propuesta_lista" },
      proposal: { kind: "note", recipeId: r.id, recipeTitle: r.title, text },
    };
  },
} satisfies ToolDef<z.ZodObject<{ recipe_id: z.ZodString; text: z.ZodString }>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ASSISTANT_TOOLS: ToolDef<any>[] = [
  getRecipe,
  searchRecipes,
  getIngredientInfo,
  checkCompatibility,
  proposeRecipeChange,
  proposeNote,
];

/** Definiciones para la API de Anthropic (JSON Schema derivado de Zod). */
export function toolDefinitions(): Anthropic.Messages.Tool[] {
  return ASSISTANT_TOOLS.map((t) => {
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

/** Ejecuta una herramienta validando la entrada con su esquema Zod. */
export async function runTool(name: string, input: unknown, ctx: ToolCtx): Promise<ToolOutput> {
  const tool = ASSISTANT_TOOLS.find((t) => t.name === name);
  if (!tool) return { result: { error: `Herramienta desconocida: ${name}` } };
  const parsed = tool.schema.safeParse(input);
  if (!parsed.success) {
    return {
      result: {
        error: `Entrada inválida: ${parsed.error.issues.map((i: { path: PropertyKey[]; message: string }) => `${i.path.map(String).join(".")}: ${i.message}`).join("; ")}`,
      },
    };
  }
  return tool.run(parsed.data, ctx);
}

export { normalizeName };
