import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { CheckRestriction, MemberDiet } from "@/lib/domain/compatibility";
import { parseIngredientLine } from "@/lib/domain/ingredient-line";
import type { MealRule } from "@/lib/domain/meal-rules";
import type { MealSlot } from "@/lib/domain/meal-slots";
import {
  validatePlan,
  type PlanIngredient,
  type PlanIssue,
  type PlanRecipe,
  type ValidateEntry,
} from "@/lib/domain/validate-plan";
import { restrictionSchema } from "@/lib/schemas/food-profile";
import type { Database } from "@/lib/supabase/database.types";

export type Client = SupabaseClient<Database>;

/** Una comida del plan tal como la propone el agente (antes de guardarla). */
export type Candidate = {
  id: string;
  date: string;
  slot: MealSlot;
  recipe_id: string | null;
  free_text: string | null;
  servings: number | null;
  diner_ids: string[];
  cook_date: string | null;
  leftovers_of_entry_id: string | null;
  is_new_recipe: boolean;
};

/** Fórmulas por momento del plan vivo de los miembros (solo slot, fórmula y componentes). */
export async function loadMealRules(supabase: Client, groupId: string): Promise<MealRule[]> {
  const { data } = await supabase.rpc("get_group_meal_rules", { p_group_id: groupId });
  return (data ?? []).map((r) => ({
    userId: r.user_id,
    displayName: r.display_name,
    slot: r.slot,
    days: r.days && r.days.length ? r.days.map(Number) : null,
    formula: r.formula ?? "",
    components: (r.components as MealRule["components"]) ?? [],
  }));
}

export async function loadDiets(supabase: Client, groupId: string): Promise<MemberDiet[]> {
  const { data } = await supabase.rpc("get_group_diet", { p_group_id: groupId });
  return (data ?? []).map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    restrictions: (z.array(restrictionSchema).safeParse(row.restrictions).data ??
      []) as CheckRestriction[],
  }));
}

const maxFridgeDays = (shelf: unknown): number | null => {
  const fridge = (shelf as { fridge?: unknown } | null)?.fridge;
  return Array.isArray(fridge) && typeof fridge[1] === "number" ? fridge[1] : null;
};

/** Recetas del grupo (con ingredientes y datos del catálogo) listas para validar. */
export async function loadPlanRecipes(
  supabase: Client,
  groupId: string,
  recipeIds: string[],
): Promise<Map<string, PlanRecipe>> {
  const out = new Map<string, PlanRecipe>();
  if (recipeIds.length === 0) return out;
  const { data } = await supabase
    .from("recipes")
    .select(
      "id, title, recipe_ingredients(raw_text, ingredient_id, optional, ingredients(name, aliases, family, shelf_life))",
    )
    .eq("group_id", groupId)
    .is("deleted_at", null)
    .in("id", recipeIds);
  for (const r of data ?? []) {
    const ingredients: PlanIngredient[] = (r.recipe_ingredients ?? []).map((ri) => ({
      ingredientId: ri.ingredient_id,
      name:
        ri.ingredients?.name ?? (parseIngredientLine(ri.raw_text ?? "").name || ri.raw_text || ""),
      aliases: ri.ingredients?.aliases ?? [],
      families: ri.ingredients?.family ?? [],
      optional: ri.optional,
      shelfLifeFridgeDays: maxFridgeDays(ri.ingredients?.shelf_life),
    }));
    out.set(r.id, { id: r.id, title: r.title, ingredients });
  }
  return out;
}

export type CandidateValidation = {
  errors: PlanIssue[];
  warnings: PlanIssue[];
  /** Recetas citadas que no existen en el recetario del grupo. */
  missingRecipeIds: string[];
};

/** Corre `validatePlan` sobre lo que el agente quiere escribir. */
export async function validateCandidates(
  supabase: Client,
  groupId: string,
  candidates: Candidate[],
  purchaseDate?: string,
  opts: { ignoreMealRules?: boolean } = {},
): Promise<CandidateValidation> {
  const ids = [...new Set(candidates.flatMap((c) => (c.recipe_id ? [c.recipe_id] : [])))];
  const [recipes, diets, mealRules] = await Promise.all([
    loadPlanRecipes(supabase, groupId, ids),
    loadDiets(supabase, groupId),
    opts.ignoreMealRules ? Promise.resolve([] as MealRule[]) : loadMealRules(supabase, groupId),
  ]);
  const missingRecipeIds = ids.filter((id) => !recipes.has(id));
  const entries: ValidateEntry[] = candidates.map((c) => ({
    id: c.id,
    date: c.date,
    slot: c.slot,
    recipe: c.recipe_id ? (recipes.get(c.recipe_id) ?? null) : null,
    dinerIds: c.diner_ids,
    cookDate: c.cook_date,
    leftoversOfEntryId: c.leftovers_of_entry_id,
  }));
  return { ...validatePlan({ entries, diets, mealRules, purchaseDate }), missingRecipeIds };
}
