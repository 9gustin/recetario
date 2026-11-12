import "server-only";
import { MODELS } from "@/lib/ai/models";
import { formatRecipeForPrompt } from "@/lib/ai/assistant/format";
import { ADAPT_RECIPE_SYSTEM } from "@/lib/ai/prompts/adapt-recipe";
import { linkIngredients } from "@/lib/ai/recipes/parse";
import { runStructured } from "@/lib/ai/run-structured";
import {
  checkRecipeForGroup,
  type MemberCompat,
  type MemberDiet,
  type RecipeIngredientForCheck,
} from "@/lib/domain/compatibility";
import { familyLabel } from "@/lib/domain/food-families";
import { adaptedRecipeSchema } from "@/lib/schemas/adapt-recipe";
import { aiRecipeToDraft } from "@/lib/schemas/ai-recipe";
import type { RecipeDraft } from "@/lib/schemas/recipe";
import { createClient } from "@/lib/supabase/server";
import { getGroupDiets } from "@/lib/recipes/compatibility";
import { getRecipe } from "@/lib/recipes/queries";

export type AdaptResult =
  | {
      ok: true;
      data: { draft: RecipeDraft; changes: string[]; titleSuffix: string; compat: MemberCompat[] };
    }
  | { ok: false; error: string; status: number };

/** Texto de las restricciones de cada persona para el prompt. */
export function describeDiets(diets: MemberDiet[]): string {
  return diets
    .map((d) => {
      const lines = d.restrictions.map((r) => {
        const target =
          r.type === "family" ? `${familyLabel(r.target)} (familia ${r.target})` : r.target;
        const extra = r.includes?.length
          ? ` — incluye: ${r.includes.join(", ")}`
          : r.limit
            ? ` — ${r.limit}`
            : "";
        return `  - ${r.severity === "forbidden" ? "PROHIBIDO" : "LIMITAR"}: ${target}${extra}`;
      });
      return `${d.displayName?.trim() || "Una persona"}:\n${lines.join("\n") || "  (sin restricciones)"}`;
    })
    .join("\n");
}

/** Arma los datos de chequeo de los ingredientes de un borrador (todavía no guardado). */
async function draftChecks(draft: RecipeDraft): Promise<RecipeIngredientForCheck[]> {
  const ingredients = draft.ingredients ?? [];
  const ids = ingredients.map((i) => i.ingredient_id).filter((id): id is string => Boolean(id));
  const supabase = await createClient();
  const { data } = ids.length
    ? await supabase.from("ingredients").select("id, name, aliases, family").in("id", ids)
    : { data: [] };
  const byId = new Map((data ?? []).map((c) => [c.id, c]));
  return ingredients.map((i) => {
    const catalog = i.ingredient_id ? byId.get(i.ingredient_id) : undefined;
    return {
      ingredientId: i.ingredient_id ?? null,
      name: catalog?.name ?? i.name_canonical ?? i.raw_text ?? "",
      aliases: catalog?.aliases ?? [],
      families: catalog?.family ?? [],
      optional: i.optional ?? false,
    };
  });
}

/** Adapta una receta para las personas elegidas y valida el resultado por código (no solo por prompt). */
export async function adaptRecipe(opts: {
  recipeId: string;
  memberIds: string[];
  userId: string;
}): Promise<AdaptResult> {
  const recipe = await getRecipe(opts.recipeId, opts.userId);
  if (!recipe) return { ok: false, error: "No encontramos la receta.", status: 404 };

  const allDiets = await getGroupDiets(recipe.group_id);
  const diets = allDiets.filter((d) => opts.memberIds.includes(d.userId));
  if (diets.length === 0 || diets.every((d) => d.restrictions.length === 0)) {
    return {
      ok: false,
      error: "Esas personas todavía no tienen restricciones cargadas.",
      status: 422,
    };
  }

  const original = formatRecipeForPrompt({
    id: recipe.id,
    title: recipe.title,
    servings: recipe.servings,
    total_minutes: recipe.total_minutes,
    tags: recipe.tags,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
  });
  const base = `RECETA ORIGINAL:\n${original}\n\nRESTRICCIONES:\n${describeDiets(diets)}`;
  const ctx = { userId: opts.userId, groupId: recipe.group_id };

  let feedback = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const run = await runStructured({
      feature: "adapt_recipe",
      model: MODELS.smart,
      system: ADAPT_RECIPE_SYSTEM,
      content: feedback ? `${base}\n\n${feedback}` : base,
      schema: adaptedRecipeSchema,
      toolName: "guardar_receta_adaptada",
      userId: opts.userId,
      groupId: recipe.group_id,
      maxTokens: 6000,
    });
    if (!run.ok) return { ok: false, error: run.error, status: 502 };

    const linked = await linkIngredients(aiRecipeToDraft(run.data, recipe.source_url), ctx);
    const compat = checkRecipeForGroup(await draftChecks(linked.draft), diets);
    const blocked = compat.flatMap((m) =>
      m.reasons
        .filter((r) => r.severity === "forbidden")
        .map(
          (r) =>
            `${r.ingredient} (prohibido para ${m.displayName?.trim() || "una persona"}: ${r.restriction})`,
        ),
    );
    if (blocked.length === 0) {
      return {
        ok: true,
        data: {
          draft: linked.draft,
          changes: run.data.changes,
          titleSuffix: run.data.title_suffix,
          compat,
        },
      };
    }
    feedback = `La versión anterior todavía incluye ingredientes prohibidos: ${blocked.join("; ")}. Sacalos o reemplazalos y devolvé la receta completa corregida.`;
  }
  return {
    ok: false,
    error:
      "No pudimos armar una versión apta para todas esas personas. Probá con una sola persona o adaptala a mano.",
    status: 422,
  };
}
