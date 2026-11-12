import "server-only";
import { cache } from "react";
import { createAnonClient } from "@/lib/supabase/anon";
import { TOKEN_PATTERN, publicRecipeSchema, type PublicRecipe } from "@/lib/schemas/public-recipe";
import type { CookingRecipe } from "@/components/cooking/cooking-stories";

/** Receta de un link público, o null si el token no existe o fue revocado. Dedupe por request. */
export const getPublicRecipe = cache(async (token: string): Promise<PublicRecipe | null> => {
  if (!TOKEN_PATTERN.test(token)) return null;
  const { data, error } = await createAnonClient().rpc("get_public_recipe", { p_token: token });
  if (error || !data) return null;
  const parsed = publicRecipeSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
});

/** Adapta la receta pública al formato del modo cocinar (ids sintéticos: la RPC no expone los reales). */
export function toCookingRecipe(token: string, r: PublicRecipe): CookingRecipe {
  return {
    id: token,
    title: r.title,
    servings: r.servings,
    total_minutes: r.total_minutes,
    image_url: r.image_url,
    ingredients: r.ingredients.map((i, index) => ({
      id: `pub-i-${index}`,
      ingredient_id: null,
      raw_text: i.raw_text,
      quantity: i.quantity,
      unit: i.unit,
      preparation: i.preparation,
      section: i.section,
      optional: i.optional,
      position: i.position,
    })),
    steps: r.steps.map((s, index) => ({
      id: `pub-s-${index}`,
      position: s.position,
      instruction: s.instruction,
      duration_seconds: s.duration_seconds,
      timer_kind: s.timer_kind,
      tip: s.tip,
      ingredient_ids: [],
    })),
  };
}
