import "server-only";
import { createClient } from "@/lib/supabase/server";

export type IngredientRow = {
  id: string;
  ingredient_id: string | null;
  raw_text: string | null;
  quantity: number | null;
  unit: string | null;
  preparation: string | null;
  section: string | null;
  optional: boolean;
  position: number;
};

export type StepRow = {
  id: string;
  position: number;
  instruction: string;
  duration_seconds: number | null;
  timer_kind: string | null;
  tip: string | null;
  ingredient_ids: string[] | null;
};

export type RecipeDetail = {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  total_minutes: number | null;
  difficulty: string | null;
  tags: string[];
  source_type: string;
  source_url: string | null;
  current_version: number;
  status: string;
  ingredients: IngredientRow[];
  steps: StepRow[];
  is_favorite: boolean;
  /** Se rellena en la Etapa 3 (sesiones de cocina). */
  last_cooked_at: string | null;
};

export async function getRecipe(id: string, userId: string): Promise<RecipeDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select(
      "id, group_id, title, description, image_url, servings, prep_minutes, cook_minutes, total_minutes, difficulty, tags, source_type, source_url, current_version, status, recipe_ingredients(id, ingredient_id, raw_text, quantity, unit, preparation, section, optional, position), recipe_steps(id, position, instruction, duration_seconds, timer_kind, tip, ingredient_ids)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) return null;

  const { data: fav } = await supabase
    .from("recipe_favorites")
    .select("recipe_id")
    .eq("recipe_id", id)
    .eq("user_id", userId)
    .maybeSingle();

  return {
    id: data.id,
    group_id: data.group_id,
    title: data.title,
    description: data.description,
    image_url: data.image_url,
    servings: data.servings,
    prep_minutes: data.prep_minutes,
    cook_minutes: data.cook_minutes,
    total_minutes: data.total_minutes,
    difficulty: data.difficulty,
    tags: data.tags ?? [],
    source_type: data.source_type,
    source_url: data.source_url,
    current_version: data.current_version,
    status: data.status,
    ingredients: (data.recipe_ingredients ?? []).slice().sort((a, b) => a.position - b.position),
    steps: (data.recipe_steps ?? []).slice().sort((a, b) => a.position - b.position),
    is_favorite: Boolean(fav),
    last_cooked_at: null,
  };
}

export type RecipeListItem = {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  servings: number;
  total_minutes: number | null;
  difficulty: string | null;
  tags: string[];
  created_at: string;
};

export type RecipeFilters = {
  q?: string;
  tags?: string[];
  maxMinutes?: number;
  offset?: number;
  limit?: number;
};

export async function listRecipes(groupId: string, filters: RecipeFilters = {}) {
  const supabase = await createClient();
  const limit = filters.limit ?? 24;
  const offset = filters.offset ?? 0;

  let query = supabase
    .from("recipes")
    .select(
      "id, group_id, title, description, image_url, servings, total_minutes, difficulty, tags, created_at",
      { count: "exact" },
    )
    .eq("group_id", groupId)
    .is("deleted_at", null);

  if (filters.q?.trim()) {
    query = query.textSearch("search_tsv", filters.q.trim(), {
      config: "spanish_unaccent",
      type: "websearch",
    });
  }
  if (filters.tags?.length) {
    query = query.contains("tags", filters.tags);
  }
  if (filters.maxMinutes) {
    query = query.lte("total_minutes", filters.maxMinutes);
  }

  const { data, count, error } = await query
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  return { data: (data ?? []) as RecipeListItem[], count: count ?? 0, error };
}

export type RecipeVersion = {
  id: string;
  version: number;
  snapshot: Record<string, unknown>;
  changed_by: string | null;
  change_note: string | null;
  origin: string;
  created_at: string;
};

export async function getVersions(recipeId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipe_versions")
    .select("id, version, snapshot, changed_by, change_note, origin, created_at")
    .eq("recipe_id", recipeId)
    .order("version", { ascending: false });
  return { data: (data ?? []) as RecipeVersion[], error };
}

/** Etiquetas más usadas del grupo (para los chips de filtro) y cantidad total de recetas. */
export async function getRecipeFacets(groupId: string, topN = 5) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("recipes")
    .select("tags")
    .eq("group_id", groupId)
    .is("deleted_at", null);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    for (const tag of row.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  const topTags = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([tag]) => tag);
  return { topTags, total: data?.length ?? 0 };
}
