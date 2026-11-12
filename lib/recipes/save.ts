import type { SupabaseClient } from "@supabase/supabase-js";
import { matchLocal } from "@/lib/domain/ingredient-match";
import { parseIngredientLine } from "@/lib/domain/ingredient-line";
import { recipeInputSchema } from "@/lib/schemas/recipe";
import type { Database } from "@/lib/supabase/database.types";

/** Guarda una receta (vinculando ingredientes al catálogo) con el cliente dado; sin dependencias de Next. */
export async function saveRecipeWith(
  supabase: SupabaseClient<Database>,
  raw: unknown,
): Promise<
  { ok: true; data: { id: string; current_version: number } } | { ok: false; error: string }
> {
  const parsed = recipeInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Revisá los datos de la receta." };

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
  return { ok: true, data: { id: saved.id, current_version: saved.current_version } };
}
