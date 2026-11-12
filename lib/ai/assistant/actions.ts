"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { applyCookingEdits } from "@/lib/domain/apply-cooking-edits";
import { saveRecipe } from "@/lib/recipes/actions";
import { getRecipe } from "@/lib/recipes/queries";
import { cookingEditsSchema } from "@/lib/schemas/cooking-edits";

type Result = { ok: true } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Arma la entrada de `saveRecipe` desde una receta del detalle + una lista de ingredientes/pasos nuevos. */
function toSaveInput(
  recipe: NonNullable<Awaited<ReturnType<typeof getRecipe>>>,
  ingredients: {
    raw_text: string | null;
    ingredient_id: string | null;
    quantity: number | null;
    unit: string | null;
    preparation: string | null;
    section: string | null;
    optional: boolean;
  }[],
  steps: {
    instruction: string;
    duration_seconds: number | null;
    timer_kind: string | null;
    tip: string | null;
    ingredient_ids: string[] | null;
  }[],
  extra: { description?: string | null; change_note: string },
) {
  return {
    id: recipe.id,
    group_id: recipe.group_id,
    title: recipe.title,
    description: extra.description === undefined ? recipe.description : extra.description,
    image_url: recipe.image_url,
    servings: recipe.servings,
    prep_minutes: recipe.prep_minutes,
    cook_minutes: recipe.cook_minutes,
    total_minutes: recipe.total_minutes,
    difficulty: recipe.difficulty,
    tags: recipe.tags,
    source_type: recipe.source_type,
    source_url: recipe.source_url,
    ingredients: ingredients.map((i, position) => ({ ...i, raw_text: i.raw_text ?? "", position })),
    steps: steps.map((s, position) => ({
      position,
      instruction: s.instruction,
      duration_seconds: s.duration_seconds,
      timer_kind: s.timer_kind,
      tip: s.tip,
      ingredient_ids: (s.ingredient_ids ?? []).filter((id) => UUID.test(id)),
    })),
    change_note: extra.change_note,
    origin: "edit" as const,
  };
}

const changeSchema = z.object({
  recipeId: z.string().uuid(),
  changeNote: z.string().trim().min(1).max(200),
  ops: cookingEditsSchema.min(1),
});

/** "Sumarlo a la receta": aplica el cambio que propuso el asistente como una versión nueva. */
export async function applyRecipeChangeProposal(raw: unknown): Promise<Result> {
  const parsed = changeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "La propuesta no es válida." };
  const user = await requireUser();
  const recipe = await getRecipe(parsed.data.recipeId, user.id);
  if (!recipe) return { ok: false, error: "No encontramos la receta." };

  const applied = applyCookingEdits(
    { ingredients: recipe.ingredients, steps: recipe.steps },
    parsed.data.ops,
  );
  const res = await saveRecipe(
    toSaveInput(recipe, applied.ingredients, applied.steps, {
      change_note: parsed.data.changeNote,
    }),
  );
  if (!res.ok) return { ok: false, error: "No se pudo guardar el cambio en la receta." };
  revalidatePath(`/g/${recipe.group_id}/recetas/${recipe.id}`);
  return { ok: true };
}

const noteSchema = z.object({
  recipeId: z.string().uuid(),
  text: z.string().trim().min(1).max(400),
});

/** "Anotar en la receta": agrega la aclaración al final de la descripción (queda como versión). */
export async function addRecipeNote(raw: unknown): Promise<Result> {
  const parsed = noteSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "La nota no es válida." };
  const user = await requireUser();
  const recipe = await getRecipe(parsed.data.recipeId, user.id);
  if (!recipe) return { ok: false, error: "No encontramos la receta." };

  const description = [recipe.description, `Nota: ${parsed.data.text}`]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2000);
  const res = await saveRecipe(
    toSaveInput(recipe, recipe.ingredients, recipe.steps, {
      description,
      change_note: "Nota agregada desde Preguntale",
    }),
  );
  if (!res.ok) return { ok: false, error: "No se pudo guardar la nota." };
  revalidatePath(`/g/${recipe.group_id}/recetas/${recipe.id}`);
  return { ok: true };
}
