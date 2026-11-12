import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { ITEM_COLUMNS, type ListItem, type ListRow } from "./types";

export async function getActiveLists(groupId: string): Promise<ListRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shopping_lists")
    .select("id, group_id, name, status, shop_date")
    .eq("group_id", groupId)
    .eq("status", "active")
    .order("shop_date", { ascending: true });
  return data ?? [];
}

export async function getList(listId: string): Promise<ListRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shopping_lists")
    .select("id, group_id, name, status, shop_date")
    .eq("id", listId)
    .maybeSingle();
  return data;
}

export async function getListItems(
  listId: string,
  client?: SupabaseClient<Database>,
): Promise<ListItem[]> {
  const supabase = client ?? (await createClient());
  const { data } = await supabase
    .from("shopping_list_items")
    .select(ITEM_COLUMNS)
    .eq("list_id", listId)
    .order("aisle")
    .order("position");
  return (data ?? []).map((r) => ({
    ...r,
    quantity: r.quantity === null ? null : Number(r.quantity),
    state: r.state as ListItem["state"],
  }));
}

/** Resumen de la lista activa más próxima (para la tarjeta de "Hoy"). */
export async function getActiveListProgress(groupId: string) {
  const lists = await getActiveLists(groupId);
  const list = lists[0];
  if (!list) return null;
  const items = (await getListItems(list.id)).filter((i) => !i.no_longer_needed);
  return {
    list,
    total: items.length,
    done: items.filter((i) => i.state !== "pending").length,
  };
}
