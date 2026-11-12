import { createClient } from "@supabase/supabase-js";
import { matchLocal } from "../../../lib/domain/ingredient-match";
import { parseIngredientLine } from "../../../lib/domain/ingredient-line";

try {
  process.loadEnvFile(".env.local");
} catch {
  // En CI las variables ya vienen del entorno.
}

export type SeedStep = {
  instruction: string;
  minutes?: number;
  passive?: boolean;
  tip?: string;
};

export type SeedRecipe = {
  title: string;
  servings?: number;
  ingredients: string[];
  steps: SeedStep[];
  totalMinutes?: number;
  tags?: string[];
};

/**
 * Crea una receta como el usuario indicado (inicia sesión con email y contraseña y llama a
 * `save_recipe`, igual que la app). Devuelve su id.
 */
export async function seedRecipe(
  email: string,
  password: string,
  groupId: string,
  recipe: SeedRecipe,
): Promise<string> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) throw authError;

  // Igual que la app: cada ingrediente se vincula al catálogo cuando coincide.
  const { data: catalogRows } = await supabase.from("ingredients").select("id, name, aliases");
  const catalog = (catalogRows ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    aliases: c.aliases ?? [],
  }));

  const { data, error } = await supabase.rpc("save_recipe", {
    p_recipe: {
      group_id: groupId,
      title: recipe.title,
      servings: recipe.servings ?? 2,
      total_minutes: recipe.totalMinutes ?? null,
      tags: recipe.tags ?? [],
      ingredients: recipe.ingredients.map((raw, position) => {
        const m = raw.match(/^(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|cda|cdita|taza)?\s+(?:de\s+)?(.+)$/i);
        return {
          raw_text: raw,
          quantity: m ? Number(m[1]!.replace(",", ".")) : null,
          unit: m?.[2]?.toLowerCase() ?? null,
          position,
          ingredient_id: matchLocal(parseIngredientLine(raw).name, catalog)?.id ?? null,
        };
      }),
      steps: recipe.steps.map((s, position) => ({
        position,
        instruction: s.instruction,
        duration_seconds: s.minutes ? s.minutes * 60 : null,
        timer_kind: s.minutes ? (s.passive ? "passive" : "active") : null,
        tip: s.tip ?? null,
      })),
    },
  });
  if (error) throw error;
  return (data as { id: string }).id;
}

/** Crea un grupo como el usuario indicado (RPC `create_group`). Devuelve su id. */
export async function createGroupAs(
  email: string,
  password: string,
  name: string,
  emoji = "🏠",
): Promise<string> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) throw authError;
  const { data, error } = await supabase.rpc("create_group", { p_name: name, p_emoji: emoji });
  if (error) throw error;
  return data as string;
}
