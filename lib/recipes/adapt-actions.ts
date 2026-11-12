"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { recipeDraftSchema } from "@/lib/schemas/recipe";
import { createClient } from "@/lib/supabase/server";
import { saveRecipe } from "./actions";
import { getRecipe } from "./queries";

const schema = z.object({
  recipeId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  draft: recipeDraftSchema,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "Guardar como variante": crea una receta nueva, vinculada a la original (no la pisa). */
export async function saveAdaptedVariant(
  raw: unknown,
): Promise<{ ok: true; data: { id: string; groupId: string } } | { ok: false; error: string }> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "La variante no es válida." };
  const user = await requireUser();
  const original = await getRecipe(parsed.data.recipeId, user.id);
  if (!original) return { ok: false, error: "No encontramos la receta original." };

  const { draft } = parsed.data;
  if (!draft.ingredients?.length || !draft.steps?.length)
    return { ok: false, error: "La variante no tiene ingredientes o pasos." };

  const saved = await saveRecipe({
    group_id: original.group_id,
    title: parsed.data.title,
    description: draft.description ?? original.description,
    image_url: original.image_url,
    servings: draft.servings ?? original.servings,
    prep_minutes: draft.prep_minutes ?? null,
    cook_minutes: draft.cook_minutes ?? null,
    total_minutes: draft.total_minutes ?? null,
    difficulty: draft.difficulty ?? original.difficulty,
    tags: draft.tags,
    source_type: "fork",
    ingredients: draft.ingredients.map((i, position) => ({ ...i, raw_text: i.raw_text, position })),
    steps: draft.steps.map((s, position) => ({
      ...s,
      position,
      ingredient_ids: (s.ingredient_ids ?? []).filter((id) => UUID.test(id)),
    })),
    change_note: `Adaptada de "${original.title}"`,
    origin: "edit",
  });
  if (!saved.ok) return { ok: false, error: "No pudimos guardar la variante." };

  // Vínculo con la original (mismo mecanismo que las copias compartidas).
  const supabase = await createClient();
  const { data: group } = await supabase
    .from("groups")
    .select("name")
    .eq("id", original.group_id)
    .maybeSingle();
  await supabase
    .from("recipes")
    .update({
      forked_from_recipe_id: original.id,
      forked_from_version: original.current_version,
      forked_from_title: original.title,
      forked_from_group_name: group?.name ?? null,
    })
    .eq("id", saved.data.id);

  revalidatePath(`/g/${original.group_id}/recetas`);
  return { ok: true, data: { id: saved.data.id, groupId: original.group_id } };
}
