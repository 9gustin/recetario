import "server-only";
import { createClient } from "@/lib/supabase/server";

/** URL pública de un token de compartir. */
export function publicRecipeUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  return `${base}/r/${token}`;
}

/** Link público activo de la receta (si alguien ya la compartió), o null. */
export async function getActiveShareUrl(recipeId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("recipe_share_links")
    .select("token")
    .eq("recipe_id", recipeId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? publicRecipeUrl(data.token) : null;
}

export type ShareContact = { id: string; name: string; avatar_url: string | null };

/** Personas con las que comparto algún grupo (RLS de `profiles` ya limita a ellas), sin duplicados. */
export async function getShareContacts(userId: string): Promise<ShareContact[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .neq("id", userId)
    .order("display_name");
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.display_name?.trim() || "Sin nombre",
    avatar_url: p.avatar_url,
  }));
}
