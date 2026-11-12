"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { enrichShoppingList } from "@/lib/ai/shopping/enrich";
import { checkQuota } from "@/lib/ai/rate-limit";
import { displayName, notifyGroup } from "@/lib/inbox/notify";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { matchLocal } from "@/lib/domain/ingredient-match";
import { generateShoppingLists } from "./generate";
import { getListItems } from "./queries";
import { ITEM_COLUMNS, type ListItem } from "./types";

/** Genera o actualiza la lista de compras del plan (conserva lo tachado). */
export async function generateListForPlan(
  raw: unknown,
): Promise<{ ok: true; data: { listIds: string[] } } | { ok: false; error: string }> {
  const parsed = z.object({ planId: z.string().uuid(), groupId: z.string().uuid() }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  const user = await requireUser();
  const supabase = await createClient();
  const result = await generateShoppingLists(supabase, parsed.data.planId);
  if (!result.ok) return result;
  // La lista ya se ve; los consejos de compra y vida útil llegan después por realtime.
  after(async () => {
    try {
      if (!(await checkQuota(user.id, "ideas"))) return;
      for (const listId of result.listIds)
        await enrichShoppingList(supabase, {
          listId,
          userId: user.id,
          groupId: parsed.data.groupId,
        });
    } catch {
      // Es un extra: si falla, la lista funciona igual.
    }
  });
  revalidatePath(`/g/${parsed.data.groupId}/compras`);
  return { ok: true, data: { listIds: result.listIds } };
}

const itemId = z.string().uuid();

/** Marca un ítem (comprado / ya lo tengo / pendiente) guardando quién y cuándo. */
export async function setItemState(
  raw: unknown,
): Promise<{ ok: true; data: ListItem } | { ok: false; error: string }> {
  const parsed = z
    .object({ id: itemId, state: z.enum(["pending", "bought", "have_it"]) })
    .safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_item_state", {
    p_item_id: parsed.data.id,
    p_state: parsed.data.state,
  });
  if (error) return { ok: false, error: "No se pudo marcar el ítem." };
  const { data } = await supabase
    .from("shopping_list_items")
    .select(ITEM_COLUMNS)
    .eq("id", parsed.data.id)
    .single();
  if (!data) return { ok: false, error: "No se pudo marcar el ítem." };
  if (parsed.data.state !== "pending") await maybeNotifyListDone(supabase, data.list_id, user.id);
  else
    await supabase
      .from("shopping_lists")
      .update({ status: "active" })
      .eq("id", data.list_id)
      .eq("status", "done");
  return {
    ok: true,
    data: {
      ...data,
      quantity: data.quantity === null ? null : Number(data.quantity),
      state: data.state as ListItem["state"],
    },
  };
}

/** Agrega algo a mano; la sección sale del catálogo si el nombre coincide. */
export async function addManualItem(
  raw: unknown,
): Promise<{ ok: true; data: ListItem } | { ok: false; error: string }> {
  const parsed = z
    .object({ listId: z.string().uuid(), name: z.string().trim().min(1).max(80) })
    .safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Escribí qué falta comprar." };
  await requireUser();
  const supabase = await createClient();
  const { data: catalog } = await supabase.from("ingredients").select("id, name, aliases, aisle");
  const match = matchLocal(
    parsed.data.name,
    (catalog ?? []).map((c) => ({ id: c.id, name: c.name, aliases: c.aliases ?? [] })),
  );
  const info = (catalog ?? []).find((c) => c.id === match?.id);
  const { data, error } = await supabase
    .from("shopping_list_items")
    .insert({
      list_id: parsed.data.listId,
      display_name: parsed.data.name,
      ingredient_id: match?.id ?? null,
      aisle: info?.aisle || "otros",
      is_manual: true,
      position: 1000,
    })
    .select(ITEM_COLUMNS)
    .single();
  if (error || !data) return { ok: false, error: "No se pudo agregar." };
  return {
    ok: true,
    data: {
      ...data,
      quantity: data.quantity === null ? null : Number(data.quantity),
      state: data.state as ListItem["state"],
    },
  };
}

export async function archiveList(
  raw: unknown,
): Promise<{ ok: true; data: null } | { ok: false; error: string }> {
  const parsed = z.object({ listId: z.string().uuid(), groupId: z.string().uuid() }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("shopping_lists")
    .update({ status: "archived" })
    .eq("id", parsed.data.listId);
  if (error) return { ok: false, error: "No se pudo archivar." };
  revalidatePath(`/g/${parsed.data.groupId}/compras`);
  return { ok: true, data: null };
}

/** Vuelve a leer los ítems de una lista (lo usa el tiempo real). */
export async function fetchListItems(listId: string): Promise<ListItem[]> {
  if (!itemId.safeParse(listId).success) return [];
  await requireUser();
  return getListItems(listId);
}

/** Cuando ya no queda nada pendiente, avisa al grupo (una sola vez por lista). */
async function maybeNotifyListDone(
  supabase: SupabaseClient<Database>,
  listId: string,
  userId: string,
) {
  const { data: pending } = await supabase
    .from("shopping_list_items")
    .select("id")
    .eq("list_id", listId)
    .eq("state", "pending")
    .eq("no_longer_needed", false)
    .limit(1);
  if (pending && pending.length > 0) return;
  const { data: list } = await supabase
    .from("shopping_lists")
    .select("id, group_id, name, status")
    .eq("id", listId)
    .maybeSingle();
  if (!list || list.status !== "active") return;
  await supabase.from("shopping_lists").update({ status: "done" }).eq("id", listId);
  void displayName(userId).then((name) =>
    notifyGroup({
      groupId: list.group_id,
      fromUserId: userId,
      kind: "list_done",
      message: `${name} terminó la compra (${list.name})`,
      url: `/g/${list.group_id}/compras`,
    }),
  );
}
