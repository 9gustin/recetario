import "server-only";
import { createClient } from "@/lib/supabase/server";
import { cookingEditsSchema } from "@/lib/schemas/cooking-edits";
import { SESSION_MAX_AGE_MS, isResumable, type OpenSession } from "@/lib/domain/cooking-session";

/** Última sesión sin terminar de esta persona para la receta (menos de 12 h). */
export async function getOpenSession(
  recipeId: string,
  userId: string,
): Promise<OpenSession | null> {
  const supabase = await createClient();
  const since = new Date(Date.now() - SESSION_MAX_AGE_MS).toISOString();
  const { data } = await supabase
    .from("cooking_sessions")
    .select("id, current_step, servings, started_at, finished_at, pending_edits")
    .eq("recipe_id", recipeId)
    .eq("user_id", userId)
    .is("finished_at", null)
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const edits = cookingEditsSchema.safeParse(data.pending_edits);
  return {
    ...data,
    servings: Number(data.servings),
    pending_edits: edits.success ? edits.data : [],
  };
}

/** Sesión que se puede retomar (reciente, sin terminar y a mitad de camino), o null. */
export async function getResumableSession(
  recipeId: string,
  userId: string,
  stepCount: number,
): Promise<OpenSession | null> {
  const open = await getOpenSession(recipeId, userId);
  return open && isResumable(open, stepCount + 2, Date.now()) ? open : null;
}

export type CookingSummary = {
  /** La última vez que alguien del grupo la cocinó. */
  last: { finished_at: string; rating: number | null; cooked_by: string | null } | null;
  /** Notas propias de sesiones anteriores (las más recientes primero). */
  notes: { finished_at: string; rating: number | null; note: string }[];
};

export async function getCookingSummary(recipeId: string, userId: string): Promise<CookingSummary> {
  const supabase = await createClient();
  const [{ data: last }, { data: notes }] = await Promise.all([
    supabase.rpc("recipe_last_cooked", { p_recipe_id: recipeId }),
    supabase
      .from("cooking_sessions")
      .select("finished_at, rating, note")
      .eq("recipe_id", recipeId)
      .eq("user_id", userId)
      .not("finished_at", "is", null)
      .not("note", "is", null)
      .order("finished_at", { ascending: false })
      .limit(5),
  ]);
  const first = last?.[0];
  return {
    last: first?.finished_at
      ? { finished_at: first.finished_at, rating: first.rating, cooked_by: first.cooked_by }
      : null,
    notes: (notes ?? []).flatMap((n) =>
      n.finished_at && n.note
        ? [{ finished_at: n.finished_at, rating: n.rating, note: n.note }]
        : [],
    ),
  };
}
