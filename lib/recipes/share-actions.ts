"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { publicRecipeUrl } from "./share-queries";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const recipeIdSchema = z.object({ recipeId: z.string().uuid() });

/** Crea (o reutiliza) el link público de la receta. */
export async function createShareLink(raw: unknown): Promise<Result<{ url: string }>> {
  const parsed = recipeIdSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Receta inválida." };
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_share_link", {
    p_recipe_id: parsed.data.recipeId,
  });
  if (error || !data) return { ok: false, error: "No se pudo crear el link." };
  return { ok: true, data: { url: publicRecipeUrl(data) } };
}

/** "Dejar de compartir": el link deja de funcionar. */
export async function revokeShareLink(raw: unknown): Promise<Result<null>> {
  const parsed = recipeIdSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Receta inválida." };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_share_link", { p_recipe_id: parsed.data.recipeId });
  if (error) return { ok: false, error: "No se pudo dejar de compartir." };
  return { ok: true, data: null };
}

const copySchema = z.object({ recipeId: z.string().uuid(), targetGroupId: z.string().uuid() });

/** Copia la receta a otro de mis grupos. */
export async function copyRecipeToGroup(
  raw: unknown,
): Promise<Result<{ recipeId: string; groupId: string }>> {
  const parsed = copySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fork_recipe", {
    p_source_recipe_id: parsed.data.recipeId,
    p_target_group_id: parsed.data.targetGroupId,
  });
  if (error || !data) return { ok: false, error: "No se pudo copiar la receta." };
  revalidatePath(`/g/${parsed.data.targetGroupId}/recetas`);
  return { ok: true, data: { recipeId: data, groupId: parsed.data.targetGroupId } };
}

const sendSchema = z.object({ recipeId: z.string().uuid(), userId: z.string().uuid() });

/** Manda la receta a la bandeja de una persona con la que comparto un grupo. */
export async function sendRecipeToPerson(raw: unknown): Promise<Result<null>> {
  const parsed = sendSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_recipe_to_user", {
    p_recipe_id: parsed.data.recipeId,
    p_user_id: parsed.data.userId,
  });
  if (error) return { ok: false, error: "No se pudo enviar la receta." };
  return { ok: true, data: null };
}
