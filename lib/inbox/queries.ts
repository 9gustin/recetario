import "server-only";
import { createClient } from "@/lib/supabase/server";

export type InboxItem = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
};

/** Ítems sin resolver de la bandeja (los más nuevos primero). La RLS limita a los del usuario. */
export async function getInboxItems(): Promise<InboxItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inbox_items")
    .select("id, kind, payload, created_at, read_at")
    .is("resolved_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((i) => ({
    ...i,
    payload: (i.payload && typeof i.payload === "object" && !Array.isArray(i.payload)
      ? i.payload
      : {}) as Record<string, unknown>,
  }));
}

/** Cantidad de ítems sin resolver (consulta liviana para el badge de la barra inferior). */
export async function getUnresolvedInboxCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("inbox_items")
    .select("id", { count: "exact", head: true })
    .is("resolved_at", null);
  return count ?? 0;
}
