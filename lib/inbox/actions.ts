"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const acceptSchema = z.object({ inboxId: z.string().uuid(), targetGroupId: z.string().uuid() });

/** Guarda la receta que me mandaron en el grupo que elegí. */
export async function acceptInboxRecipe(
  raw: unknown,
): Promise<Result<{ recipeId: string; groupId: string }>> {
  const parsed = acceptSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_inbox_recipe", {
    p_inbox_id: parsed.data.inboxId,
    p_target_group_id: parsed.data.targetGroupId,
  });
  if (error || !data) return { ok: false, error: "No se pudo guardar la receta." };
  revalidatePath("/perfil/bandeja");
  revalidatePath(`/g/${parsed.data.targetGroupId}/recetas`);
  return { ok: true, data: { recipeId: data, groupId: parsed.data.targetGroupId } };
}

/** Descarta un ítem de la bandeja. */
export async function dismissInboxItem(raw: unknown): Promise<Result<null>> {
  const parsed = z.object({ inboxId: z.string().uuid() }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  const user = await requireUser();
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("inbox_items")
    .update({ resolved_at: now, read_at: now })
    .eq("id", parsed.data.inboxId)
    .eq("user_id", user.id)
    .is("resolved_at", null);
  if (error) return { ok: false, error: "No se pudo descartar." };
  revalidatePath("/perfil/bandeja");
  return { ok: true, data: null };
}
