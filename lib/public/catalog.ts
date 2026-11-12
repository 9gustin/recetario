import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  checkRecipe,
  type MemberDiet,
  type RecipeIngredientForCheck,
} from "@/lib/domain/compatibility";
import { parseIngredientLine } from "@/lib/domain/ingredient-line";
import { matchLocal, type CatalogIngredient } from "@/lib/domain/ingredient-match";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export type CatalogHit = {
  id: string;
  slug: string;
  title: string;
  image_url: string | null;
  total_minutes: number | null;
  tags: string[];
  servings: number;
  ingredients: RecipeIngredientForCheck[];
};

/** Busca en el catálogo público (sin IA) y trae los ingredientes con sus familias para validar restricciones por código. */
export async function searchCatalog(
  supabase: Client,
  args: {
    q?: string;
    maxMinutes?: number;
    tag?: string;
    limit?: number;
    excludeIds?: string[];
    diets?: MemberDiet[];
  },
): Promise<CatalogHit[]> {
  const { data } = await supabase.rpc("search_public_recipes", {
    p_q: args.q?.trim() || undefined,
    p_max_minutes: args.maxMinutes,
    p_tag: args.tag,
    p_catalog: "catalog",
    p_limit: Math.min((args.limit ?? 8) * 3, 60),
    p_offset: 0,
  });
  const rows = (data ?? []).filter((r) => !args.excludeIds?.includes(r.id));
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const [{ data: ing }, { data: cat }] = await Promise.all([
    supabase.rpc("public_recipe_ingredients", { p_ids: ids }),
    supabase.from("ingredients").select("id, name, aliases, family"),
  ]);
  const catalog = cat ?? [];
  const list: CatalogIngredient[] = catalog.map((c) => ({
    id: c.id,
    name: c.name,
    aliases: c.aliases ?? [],
  }));
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const byRecipe = new Map<string, RecipeIngredientForCheck[]>();
  for (const i of [...(ing ?? [])].sort((a, b) => a.pos - b.pos)) {
    const name = parseIngredientLine(i.raw_text ?? "").name;
    const matched = i.ingredient_id
      ? byId.get(i.ingredient_id)
      : byId.get(matchLocal(name, list)?.id ?? "");
    const item: RecipeIngredientForCheck = {
      ingredientId: matched?.id ?? null,
      name: matched?.name ?? name,
      aliases: matched?.aliases ?? [],
      families: matched?.family ?? [],
      optional: i.optional,
    };
    byRecipe.set(i.recipe_id, [...(byRecipe.get(i.recipe_id) ?? []), item]);
  }

  return (
    rows
      .map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        image_url: r.image_url,
        total_minutes: r.total_minutes,
        tags: r.tags ?? [],
        servings: Number(r.servings),
        ingredients: byRecipe.get(r.id) ?? [],
      }))
      // Lo prohibido para alguien del grupo no se ofrece nunca (validado por código).
      .filter(
        (h) =>
          !(args.diets ?? []).some(
            (d) => checkRecipe(h.ingredients, d.restrictions).status === "forbidden",
          ),
      )
      .slice(0, args.limit ?? 8)
  );
}
