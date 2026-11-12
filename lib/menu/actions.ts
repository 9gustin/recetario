"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { generateShoppingLists } from "@/lib/shopping/generate";
import { getListItems } from "@/lib/shopping/queries";
import type { ListItem } from "@/lib/shopping/types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
export type MenuSnapshot = { listId: string | null; items: ListItem[] };

const uuid = z.string().uuid();

/** Regenera la lista de compras del menú (conserva lo tachado) y la devuelve. */
async function refresh(
  supabase: Awaited<ReturnType<typeof createClient>>,
  planId: string,
  groupId: string,
): Promise<MenuSnapshot> {
  const res = await generateShoppingLists(supabase, planId);
  revalidatePath(`/g/${groupId}/plan`);
  if (!res.ok || res.listIds.length === 0) return { listId: null, items: [] };
  const listId = res.listIds[0]!;
  return { listId, items: await getListItems(listId) };
}

/** Agrega una comida al menú (receta o texto libre). Se guarda sola y actualiza las compras. */
export async function addMenuEntry(raw: unknown): Promise<Result<MenuSnapshot & { id: string }>> {
  const parsed = z
    .object({
      groupId: uuid,
      recipeId: uuid.optional(),
      freeText: z.string().trim().min(1).max(200).optional(),
      quantity: z.number().int().min(1).max(20).optional(),
    })
    .refine((v) => v.recipeId || v.freeText, { message: "Elegí una receta o escribí algo." })
    .safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { data: planId } = await supabase.rpc("get_or_create_menu", {
    p_group_id: parsed.data.groupId,
  });
  if (!planId) return { ok: false, error: "No pudimos abrir tus comidas." };
  const { data, error } = await supabase
    .from("meal_plan_entries")
    .insert({
      plan_id: planId,
      recipe_id: parsed.data.recipeId ?? null,
      free_text: parsed.data.recipeId ? null : (parsed.data.freeText ?? null),
      quantity: parsed.data.quantity ?? 1,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "No se pudo agregar la comida." };
  return {
    ok: true,
    data: { id: data.id, ...(await refresh(supabase, planId, parsed.data.groupId)) },
  };
}

/** Cambia la cantidad de veces o tilda una comida como cocinada. */
export async function updateMenuEntry(raw: unknown): Promise<Result<MenuSnapshot>> {
  const parsed = z
    .object({
      id: uuid,
      groupId: uuid,
      quantity: z.number().int().min(1).max(20).optional(),
      cooked: z.boolean().optional(),
    })
    .safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const patch: { quantity?: number; cooked_at?: string | null } = {};
  if (parsed.data.quantity !== undefined) patch.quantity = parsed.data.quantity;
  if (parsed.data.cooked !== undefined)
    patch.cooked_at = parsed.data.cooked ? new Date().toISOString() : null;
  const { data, error } = await supabase
    .from("meal_plan_entries")
    .update(patch)
    .eq("id", parsed.data.id)
    .select("plan_id")
    .single();
  if (error || !data) return { ok: false, error: "No se pudo guardar el cambio." };
  return { ok: true, data: await refresh(supabase, data.plan_id, parsed.data.groupId) };
}

/** Quita una comida del menú. */
export async function removeMenuEntry(raw: unknown): Promise<Result<MenuSnapshot>> {
  const parsed = z.object({ id: uuid, groupId: uuid }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("meal_plan_entries")
    .select("plan_id")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!entry) return { ok: false, error: "No encontramos la comida." };
  const { error } = await supabase.from("meal_plan_entries").delete().eq("id", parsed.data.id);
  if (error) return { ok: false, error: "No se pudo quitar la comida." };
  return { ok: true, data: await refresh(supabase, entry.plan_id, parsed.data.groupId) };
}

/** Regenera las compras del menú (por ejemplo, después de que la IA agregó comidas). */
export async function refreshMenuList(raw: unknown): Promise<Result<MenuSnapshot>> {
  const parsed = z.object({ groupId: uuid }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { data: planId } = await supabase.rpc("get_or_create_menu", {
    p_group_id: parsed.data.groupId,
  });
  if (!planId) return { ok: false, error: "No pudimos abrir tus comidas." };
  return { ok: true, data: await refresh(supabase, planId, parsed.data.groupId) };
}
