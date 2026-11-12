"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { emptyProfile, foodProfileDataSchema, mergeProfiles } from "@/lib/schemas/food-profile";
import { createClient } from "@/lib/supabase/server";

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

const editsSchema = z.object({
  summary: z.string().trim().max(1500).optional(),
  patch: foodProfileDataSchema.partial().optional(),
});

/** Ediciones manuales del perfil (sacar o agregar una restricción, cambiar el resumen…). Sube la versión. */
export async function saveProfileEdits(raw: unknown): Promise<Result<{ version: number }>> {
  const parsed = editsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Revisá los datos." };
  const user = await requireUser();
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("food_profiles")
    .select("data, summary, version")
    .eq("user_id", user.id)
    .maybeSingle();
  const base = foodProfileDataSchema.safeParse(row?.data ?? {}).data ?? emptyProfile();
  const data = mergeProfiles(base, parsed.data.patch ?? {});
  const version = (row?.version ?? 0) + 1;

  const { error } = await supabase.from("food_profiles").upsert({
    user_id: user.id,
    summary: parsed.data.summary ?? row?.summary ?? null,
    data,
    version,
    valid_until: data.valid_until,
  });
  if (error) return { ok: false, error: "No pudimos guardar los cambios." };
  revalidatePath("/perfil/alimentacion");
  return { ok: true, data: { version } };
}

/** Borra una fuente cargada (y su archivo de Storage si tiene). */
export async function deleteProfileInput(raw: unknown): Promise<Result> {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Fuente inválida." };
  await requireUser();
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("food_profile_inputs")
    .select("storage_path")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!row) return { ok: false, error: "No encontramos esa fuente." };
  if (row.storage_path) await supabase.storage.from("profile-inputs").remove([row.storage_path]);
  const { error } = await supabase.from("food_profile_inputs").delete().eq("id", parsed.data.id);
  if (error) return { ok: false, error: "No pudimos borrarla." };
  revalidatePath("/perfil/alimentacion");
  return { ok: true, data: null };
}

/** Descarta el borrador pendiente. */
export async function discardProfileDraft(raw: unknown): Promise<Result> {
  const parsed = z.object({ draftId: z.string().uuid() }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Borrador inválido." };
  await requireUser();
  const supabase = await createClient();
  await supabase
    .from("food_profile_drafts")
    .update({ status: "discarded" })
    .eq("id", parsed.data.draftId)
    .eq("status", "pending");
  revalidatePath("/perfil/alimentacion");
  return { ok: true, data: null };
}
