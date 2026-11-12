import "server-only";
import { parseIngredientLine } from "@/lib/domain/ingredient-line";
import {
  checkRecipe,
  type CheckRestriction,
  type MemberCompat,
  type MemberDiet,
  type RecipeIngredientForCheck,
} from "@/lib/domain/compatibility";
import { restrictionSchema } from "@/lib/schemas/food-profile";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

/** Restricciones de los miembros del grupo con perfil (solo restricciones y objetivos, vía RPC con RLS). */
export async function getGroupDiets(groupId: string): Promise<MemberDiet[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_group_diet", { p_group_id: groupId });
  return (data ?? []).map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    restrictions: (z.array(restrictionSchema).safeParse(row.restrictions).data ??
      []) as CheckRestriction[],
  }));
}

export type CheckedIngredient = { id: string; check: RecipeIngredientForCheck };

/** Ingredientes de cada receta con los datos del catálogo que necesita el chequeo. */
export async function loadIngredientsForCheck(
  recipeIds: string[],
): Promise<Map<string, CheckedIngredient[]>> {
  const out = new Map<string, CheckedIngredient[]>();
  if (recipeIds.length === 0) return out;
  const supabase = await createClient();
  const { data } = await supabase
    .from("recipe_ingredients")
    .select(
      "id, recipe_id, raw_text, ingredient_id, optional, position, ingredients(name, aliases, family)",
    )
    .in("recipe_id", recipeIds)
    .order("position");
  for (const row of data ?? []) {
    const catalog = row.ingredients;
    const check: RecipeIngredientForCheck = {
      ingredientId: row.ingredient_id,
      name: catalog?.name ?? (parseIngredientLine(row.raw_text ?? "").name || row.raw_text || ""),
      aliases: catalog?.aliases ?? [],
      families: catalog?.family ?? [],
      optional: row.optional,
    };
    const list = out.get(row.recipe_id) ?? [];
    list.push({ id: row.id, check });
    out.set(row.recipe_id, list);
  }
  return out;
}

/** Compatibilidad de varias recetas contra las dietas del grupo. */
export async function compatForRecipes(
  recipeIds: string[],
  diets: MemberDiet[],
): Promise<Map<string, MemberCompat[]>> {
  const result = new Map<string, MemberCompat[]>();
  if (diets.length === 0) return result;
  const ingredients = await loadIngredientsForCheck(recipeIds);
  for (const id of recipeIds) {
    const checks = (ingredients.get(id) ?? []).map((i) => i.check);
    result.set(
      id,
      diets.map((d) => ({
        userId: d.userId,
        displayName: d.displayName,
        ...checkRecipe(checks, d.restrictions),
      })),
    );
  }
  return result;
}

/** Recetas del grupo que están prohibidas para alguna de las personas elegidas (para el filtro "Apta para…"). */
export async function forbiddenRecipeIds(
  groupId: string,
  userIds: string[],
  diets: MemberDiet[],
): Promise<string[]> {
  const selected = diets.filter((d) => userIds.includes(d.userId));
  if (selected.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("recipes")
    .select("id")
    .eq("group_id", groupId)
    .eq("status", "active")
    .is("deleted_at", null);
  const ids = (data ?? []).map((r) => r.id);
  const compat = await compatForRecipes(ids, selected);
  return ids.filter((id) => compat.get(id)?.some((m) => m.status === "forbidden"));
}
