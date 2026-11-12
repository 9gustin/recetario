import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { PromptRecipe } from "./format";

/** Carga recetas del grupo (con RLS) con el formato que usa el prompt. Respeta el orden pedido. */
export async function loadPromptRecipes(
  supabase: SupabaseClient<Database>,
  ids: string[],
  groupId: string,
): Promise<PromptRecipe[]> {
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("recipes")
    .select(
      "id, title, servings, total_minutes, tags, recipe_ingredients(raw_text, position), recipe_steps(instruction, duration_seconds, position)",
    )
    .in("id", ids)
    .eq("group_id", groupId)
    .is("deleted_at", null);
  const byId = new Map(
    (data ?? []).map((r) => [
      r.id,
      {
        id: r.id,
        title: r.title,
        servings: Number(r.servings),
        total_minutes: r.total_minutes,
        tags: r.tags ?? [],
        ingredients: [...(r.recipe_ingredients ?? [])].sort((a, b) => a.position - b.position),
        steps: [...(r.recipe_steps ?? [])].sort((a, b) => a.position - b.position),
      } satisfies PromptRecipe,
    ]),
  );
  return ids.flatMap((id) => byId.get(id) ?? []);
}
