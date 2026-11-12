"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { recipeInputSchema } from "@/lib/schemas/recipe";
import { matchLocal } from "@/lib/domain/ingredient-match";
import { parseIngredientLine } from "@/lib/domain/ingredient-line";
import { parseSnapshot } from "@/lib/domain/recipe-diff";
import { compatForRecipes, forbiddenRecipeIds, getGroupDiets } from "./compatibility";
import type { RecipeListItem } from "./queries";
import { ingredientSearchSchema, recipeSearchSchema } from "@/lib/schemas/recipe-search";

export async function saveRecipe(
  raw: unknown,
): Promise<
  { ok: true; data: { id: string; current_version: number } } | { ok: false; error: string }
> {
  const parsed = recipeInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Revisá los datos de la receta." };

  await requireUser();
  const supabase = await createClient();

  // Resolver ingredient_id contra el catálogo (exacto/alias); el fuzzy queda para el RPC.
  const { data: catalog } = await supabase.from("ingredients").select("id, name, aliases");
  const catalogList = (catalog ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    aliases: c.aliases ?? [],
  }));

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

export async function toggleFavorite(
  raw: unknown,
): Promise<{ ok: true; data: { favorite: boolean } } | { ok: false; error: string }> {
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
    await supabase
      .from("recipe_favorites")
      .delete()
      .eq("recipe_id", recipeId)
      .eq("user_id", user.id);
    return { ok: true, data: { favorite: false } };
  }

  const { error } = await supabase
    .from("recipe_favorites")
    .insert({ recipe_id: recipeId, user_id: user.id });
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

export type RecipeCompat = {
  userId: string;
  name: string | null;
  status: "ok" | "limit" | "forbidden" | "unknown";
};
export type RecipeSearchResult = {
  recipes: (RecipeListItem & { compat: RecipeCompat[] })[];
  hasMore: boolean;
};

/** Busca y filtra recetas del grupo (RLS limita a los grupos del usuario). Paginado de a 24. */
export async function searchRecipes(
  raw: unknown,
): Promise<{ ok: true; data: RecipeSearchResult } | { ok: false; error: string }> {
  const parsed = recipeSearchSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Revisá la búsqueda." };
  const input = parsed.data;

  const user = await requireUser();
  const supabase = await createClient();

  const joins = [
    input.favoriteOnly ? "recipe_favorites!inner(user_id)" : null,
    input.ingredientId ? "recipe_ingredients!inner(ingredient_id)" : null,
  ].filter(Boolean);
  const columns =
    "id, group_id, title, description, image_url, servings, total_minutes, difficulty, tags, created_at";

  let query = supabase
    .from("recipes")
    .select([columns, ...joins].join(", "))
    .eq("group_id", input.groupId)
    .eq("status", "active")
    .is("deleted_at", null);

  if (input.q) {
    query = query.textSearch("search_tsv", input.q, {
      config: "spanish_unaccent",
      type: "websearch",
    });
  }
  if (input.favoriteOnly) query = query.eq("recipe_favorites.user_id", user.id);
  if (input.ingredientId) query = query.eq("recipe_ingredients.ingredient_id", input.ingredientId);
  if (input.tag) query = query.contains("tags", [input.tag]);

  // Compatibilidad con el perfil de los miembros del grupo (solo restricciones, vía RPC).
  const diets = await getGroupDiets(input.groupId);
  if (input.aptFor?.length) {
    const blocked = await forbiddenRecipeIds(input.groupId, input.aptFor, diets);
    if (blocked.length) query = query.not("id", "in", `(${blocked.join(",")})`);
  }
  if (input.maxMinutes) query = query.lte("total_minutes", input.maxMinutes);

  // Pedimos una fila de más para saber si hay otra página.
  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .range(input.offset, input.offset + input.limit);
  if (error) return { ok: false, error: "No se pudo buscar." };

  const rows = (data ?? []) as unknown as RecipeListItem[];
  const recipes = rows.slice(0, input.limit).map((r) => {
    const { ...item } = r as RecipeListItem & Record<string, unknown>;
    delete item.recipe_favorites;
    delete item.recipe_ingredients;
    return item as RecipeListItem;
  });
  const compat = await compatForRecipes(
    recipes.map((r) => r.id),
    diets,
  );
  return {
    ok: true,
    data: {
      recipes: recipes.map((r) => ({
        ...r,
        compat: (compat.get(r.id) ?? []).map((m) => ({
          userId: m.userId,
          name: m.displayName,
          status: m.status,
        })),
      })),
      hasMore: rows.length > input.limit,
    },
  };
}

export type IngredientSuggestion = { id: string; name: string };

/** Autocompletado de ingredientes para el filtro "Tiene ingrediente…". */
export async function searchIngredientSuggestions(
  raw: unknown,
): Promise<{ ok: true; data: IngredientSuggestion[] } | { ok: false; error: string }> {
  const parsed = ingredientSearchSchema.safeParse(raw);
  if (!parsed.success) return { ok: true, data: [] };
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_ingredients", { q: parsed.data.q, lim: 6 });
  if (error) return { ok: false, error: "No se pudo buscar ingredientes." };
  return { ok: true, data: (data ?? []).map((i) => ({ id: i.id, name: i.name })) };
}

const restoreSchema = z.object({
  recipeId: z.string().uuid(),
  version: z.number().int().positive(),
});

/** Vuelve a una versión anterior: crea una versión nueva (origin = restore), no borra historia. */
export async function restoreRecipeVersion(
  raw: unknown,
): Promise<
  { ok: true; data: { id: string; current_version: number } } | { ok: false; error: string }
> {
  const parsed = restoreSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Versión inválida." };

  await requireUser();
  const supabase = await createClient();

  const { data: recipe } = await supabase
    .from("recipes")
    .select("id, group_id")
    .eq("id", parsed.data.recipeId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!recipe) return { ok: false, error: "No encontramos la receta." };

  const { data: version } = await supabase
    .from("recipe_versions")
    .select("snapshot")
    .eq("recipe_id", recipe.id)
    .eq("version", parsed.data.version)
    .maybeSingle();
  if (!version) return { ok: false, error: "No encontramos esa versión." };

  const snap = parseSnapshot(version.snapshot);
  const result = await saveRecipe({
    id: recipe.id,
    group_id: recipe.group_id,
    title: snap.title,
    description: snap.description,
    servings: snap.servings ?? 2,
    prep_minutes: snap.prep_minutes,
    cook_minutes: snap.cook_minutes,
    total_minutes: snap.total_minutes,
    difficulty: snap.difficulty,
    tags: snap.tags,
    ingredients: snap.ingredients.map((i) => ({ ...i, raw_text: i.raw_text ?? "" })),
    steps: snap.steps,
    change_note: `Restaurada la versión ${parsed.data.version}`,
    origin: "restore",
  });
  if (result.ok) revalidatePath(`/g/${recipe.group_id}/recetas/${recipe.id}`);
  return result;
}

export type MentionRecipe = { id: string; title: string; image_url: string | null };

/** Títulos de las recetas del grupo para el autocompletado de "@" (se filtra en el cliente, sin acentos). */
export async function listRecipesForMention(
  raw: unknown,
): Promise<{ ok: true; data: MentionRecipe[] } | { ok: false; error: string }> {
  const parsed = z.object({ groupId: z.string().uuid() }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Grupo inválido." };
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("id, title, image_url")
    .eq("group_id", parsed.data.groupId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(300);
  if (error) return { ok: false, error: "No se pudieron cargar las recetas." };
  return { ok: true, data: data ?? [] };
}
