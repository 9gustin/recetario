"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { recipeInputSchema } from "@/lib/schemas/recipe";
import { matchLocal } from "@/lib/domain/ingredient-match";
import { parseIngredientLine } from "@/lib/domain/ingredient-line";

export async function saveRecipe(
  raw: unknown,
): Promise<{ ok: true; data: { id: string; current_version: number } } | { ok: false; error: string }> {
  const parsed = recipeInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Revisá los datos de la receta." };

  await requireUser();
  const supabase = await createClient();

  // Resolver ingredient_id contra el catálogo (exacto/alias); el fuzzy queda para el RPC.
  const { data: catalog } = await supabase.from("ingredients").select("id, name, aliases");
  const catalogList = (catalog ?? []).map((c) => ({ id: c.id, name: c.name, aliases: c.aliases ?? [] }));

  const ingredients = parsed.data.ingredients.map((ing) => {
    if (ing.ingredient_id) return ing;
    const name = parseIngredientLine(ing.raw_text ?? "").name;
    const match = name ? matchLocal(name, catalogList) : null;
    return { ...ing, ingredient_id: match?.id ?? null };
  });

  const { data, error } = await supabase.rpc("save_recipe", {
    p_recipe: {
      id: parsed.data.id ?? null,
      group_id: parsed.data.group_id,
      title: parsed.data.title,
      description: parsed.data.description,
      servings: parsed.data.servings,
      prep_minutes: parsed.data.prep_minutes,
      cook_minutes: parsed.data.cook_minutes,
      total_minutes: parsed.data.total_minutes,
      difficulty: parsed.data.difficulty,
      tags: parsed.data.tags,
      source_type: parsed.data.source_type,
      source_url: parsed.data.source_url,
      image_url: parsed.data.image_url,
      ingredients,
      steps: parsed.data.steps.map((s) => ({ ...s, ingredient_ids: s.ingredient_ids ?? [] })),
      change_note: parsed.data.change_note ?? null,
      origin: parsed.data.origin,
    },
  });

  if (error || !data) return { ok: false, error: "No se pudo guardar la receta." };

  const saved = data as { id: string; current_version: number };
  revalidatePath(`/g/${parsed.data.group_id}/recetas`);
  return { ok: true, data: { id: saved.id, current_version: saved.current_version } };
}

export async function deleteRecipe(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = (raw as { id?: string } | null)?.id;
  if (!id) return { ok: false, error: "Falta el id." };

  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("recipes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: "No se pudo eliminar." };
  return { ok: true };
}

export async function toggleFavorite(raw: unknown): Promise<{ ok: true; data: { favorite: boolean } } | { ok: false; error: string }> {
  const recipeId = (raw as { recipeId?: string } | null)?.recipeId;
  if (!recipeId) return { ok: false, error: "Falta la receta." };

  const user = await requireUser();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("recipe_favorites")
    .select("recipe_id")
    .eq("recipe_id", recipeId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("recipe_favorites").delete().eq("recipe_id", recipeId).eq("user_id", user.id);
    return { ok: true, data: { favorite: false } };
  }

  const { error } = await supabase.from("recipe_favorites").insert({ recipe_id: recipeId, user_id: user.id });
  if (error) return { ok: false, error: "No se pudo marcar como favorita." };
  return { ok: true, data: { favorite: true } };
}

export async function uploadRecipeImage(
  formData: FormData,
): Promise<{ ok: true; data: { imageUrl: string } } | { ok: false; error: string }> {
  const groupId = String(formData.get("groupId") ?? "");
  const recipeId = String(formData.get("recipeId") ?? "");
  const file = formData.get("file");

  if (!groupId || !recipeId || !(file instanceof File)) {
    return { ok: false, error: "Faltan datos de la foto." };
  }

  await requireUser();
  const supabase = await createClient();

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${groupId}/${recipeId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from("recipe-images").upload(path, file);
  if (error) return { ok: false, error: "No se pudo subir la foto." };

  const { data: pub } = supabase.storage.from("recipe-images").getPublicUrl(path);
  await supabase.from("recipes").update({ image_url: pub.publicUrl }).eq("id", recipeId);

  revalidatePath(`/g/${groupId}/recetas`);
  return { ok: true, data: { imageUrl: pub.publicUrl } };
}
