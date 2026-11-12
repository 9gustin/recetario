"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { searchPublic, type PublicCard } from "@/lib/public/queries";
import { createClient } from "@/lib/supabase/server";

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };
const uuid = z.string().uuid();

const MESSAGES: Record<string, string> = {
  P0002: "Ese código no es válido o ya venció.",
  "23505": "Esa acción ya se hizo.",
  "23514": "Revisá los datos e intentá de nuevo.",
  P0001: "No tenés permiso para eso.",
};
const fail = (e: { code?: string; message?: string } | null, fallback: string): Result<never> => ({
  ok: false,
  error:
    (e?.message && /^(Forbidden|Not authenticated)$/.test(e.message)
      ? MESSAGES.P0001
      : e?.code && MESSAGES[e.code]) || fallback,
});

// ---------------------------------------------------------------------------
// Profesional
// ---------------------------------------------------------------------------

export async function redeemCode(raw: unknown): Promise<Result> {
  const parsed = z
    .object({
      code: z.string().trim().min(6).max(40),
      name: z.string().trim().min(1).max(80),
      license: z.string().trim().max(40).optional(),
      bio: z.string().trim().max(500).optional(),
    })
    .safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Completá el código y tu nombre." };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("redeem_professional_code", {
    p_code: parsed.data.code,
    p_name: parsed.data.name,
    p_license: parsed.data.license ?? "",
    p_bio: parsed.data.bio ?? "",
  });
  if (error) return fail(error, "No pudimos validar el código.");
  revalidatePath("/pro");
  return { ok: true, data: null };
}

const itemSchema = z
  .object({
    recipeId: uuid.nullish(),
    title: z.string().trim().max(200).nullish(),
    freeText: z.string().trim().max(200).nullish(),
    quantity: z.number().int().min(1).max(20).default(1),
    note: z.string().trim().max(300).nullish(),
  })
  .refine((i) => i.recipeId || i.freeText, {
    message: "Cada comida necesita una receta o un texto.",
  });

/** Crea o actualiza un plan del profesional con todas sus comidas. */
export async function savePlan(raw: unknown): Promise<Result<{ id: string }>> {
  const parsed = z
    .object({
      id: uuid.optional(),
      title: z.string().trim().min(1).max(120),
      goal: z.string().trim().max(300).optional(),
      goalTags: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
      notes: z.string().trim().max(2000).optional(),
      isTemplate: z.boolean().default(false),
      items: z.array(itemSchema).max(60),
    })
    .safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const p = parsed.data;
  await requireUser();
  const supabase = await createClient();
  const fields = {
    title: p.title,
    goal: p.goal || null,
    goal_tags: p.goalTags,
    notes: p.notes || null,
    is_template: p.isTemplate,
  };
  let id = p.id;
  if (id) {
    const { error } = await supabase.from("pro_plans").update(fields).eq("id", id);
    if (error) return fail(error, "No se pudo guardar el plan.");
    await supabase.from("pro_plan_items").delete().eq("plan_id", id);
  } else {
    const { data, error } = await supabase.from("pro_plans").insert(fields).select("id").single();
    if (error || !data) return fail(error, "No se pudo crear el plan.");
    id = data.id;
  }
  if (p.items.length > 0) {
    const { error } = await supabase.from("pro_plan_items").insert(
      p.items.map((i, position) => ({
        plan_id: id!,
        recipe_id: i.recipeId ?? null,
        title: i.recipeId ? (i.title ?? null) : null,
        free_text: i.recipeId ? null : (i.freeText ?? null),
        quantity: i.quantity,
        note: i.note || null,
        position,
      })),
    );
    if (error) return fail(error, "No se pudieron guardar las comidas.");
  }
  revalidatePath("/pro");
  return { ok: true, data: { id: id! } };
}

export async function deletePlan(raw: unknown): Promise<Result> {
  const parsed = z.object({ id: uuid }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("pro_plans").delete().eq("id", parsed.data.id);
  if (error) return fail(error, "No se pudo borrar el plan.");
  revalidatePath("/pro");
  return { ok: true, data: null };
}

/** Busca recetas públicas (sin IA) para armar un plan. */
export async function searchRecipesForPlan(raw: unknown): Promise<Result<PublicCard[]>> {
  const parsed = z.object({ q: z.string().trim().max(100).optional() }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const { cards } = await searchPublic({ q: parsed.data.q });
  return { ok: true, data: cards };
}

export async function createPatientLink(raw: unknown): Promise<Result<{ token: string }>> {
  const parsed = z.object({ label: z.string().trim().min(1).max(80) }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Poné un nombre para identificar al paciente." };
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pro_create_link", { p_label: parsed.data.label });
  if (error || !data) return fail(error, "No se pudo crear la invitación.");
  revalidatePath("/pro");
  return { ok: true, data: { token: data } };
}

export async function sendPlanToPatient(raw: unknown): Promise<Result> {
  const parsed = z
    .object({ linkId: uuid, planId: uuid, message: z.string().trim().max(1000).optional() })
    .safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("pro_send_plan", {
    p_link_id: parsed.data.linkId,
    p_plan_id: parsed.data.planId,
    p_message: parsed.data.message ?? "",
  });
  if (error) return fail(error, "No se pudo enviar el plan.");
  revalidatePath(`/pro/pacientes/${parsed.data.linkId}`);
  return { ok: true, data: null };
}

export async function sendRecipesToPatient(raw: unknown): Promise<Result> {
  const parsed = z
    .object({
      linkId: uuid,
      title: z.string().trim().max(120).optional(),
      recipeIds: z.array(uuid).min(1).max(30),
      message: z.string().trim().max(1000).optional(),
    })
    .safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Elegí al menos una receta." };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("pro_send_recipes", {
    p_link_id: parsed.data.linkId,
    p_title: parsed.data.title ?? "",
    p_recipe_ids: parsed.data.recipeIds,
    p_message: parsed.data.message ?? "",
  });
  if (error) return fail(error, "No se pudieron enviar las recetas.");
  revalidatePath(`/pro/pacientes/${parsed.data.linkId}`);
  return { ok: true, data: null };
}

export async function endLink(raw: unknown): Promise<Result> {
  const parsed = z.object({ linkId: uuid }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("end_pro_link", { p_link_id: parsed.data.linkId });
  if (error) return fail(error, "No se pudo terminar el vínculo.");
  revalidatePath("/pro");
  revalidatePath("/perfil/profesional");
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// Paciente
// ---------------------------------------------------------------------------

export async function acceptLink(raw: unknown): Promise<Result> {
  const parsed = z
    .object({ token: z.string().min(8).max(64), shareMeals: z.boolean(), shareNotes: z.boolean() })
    .safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_pro_link", {
    p_token: parsed.data.token,
    p_share_meals: parsed.data.shareMeals,
    p_share_notes: parsed.data.shareNotes,
  });
  if (error) return fail(error, "No se pudo aceptar la invitación.");
  revalidatePath("/perfil/profesional");
  return { ok: true, data: null };
}

export async function updateSharing(raw: unknown): Promise<Result> {
  const parsed = z
    .object({ linkId: uuid, shareMeals: z.boolean(), shareNotes: z.boolean() })
    .safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_pro_link_sharing", {
    p_link_id: parsed.data.linkId,
    p_share_meals: parsed.data.shareMeals,
    p_share_notes: parsed.data.shareNotes,
  });
  if (error) return fail(error, "No se pudo guardar.");
  revalidatePath("/perfil/profesional");
  return { ok: true, data: null };
}

export async function acceptDelivery(raw: unknown): Promise<Result<{ saved: number }>> {
  const parsed = z
    .object({ deliveryId: uuid, groupId: uuid, addToMenu: z.boolean() })
    .safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_pro_delivery", {
    p_delivery_id: parsed.data.deliveryId,
    p_group_id: parsed.data.groupId,
    p_add_to_menu: parsed.data.addToMenu,
  });
  if (error) return fail(error, "No se pudo guardar el envío.");
  revalidatePath("/perfil/profesional");
  revalidatePath("/perfil/bandeja");
  return { ok: true, data: { saved: data ?? 0 } };
}

export async function dismissDelivery(raw: unknown): Promise<Result> {
  const parsed = z.object({ deliveryId: uuid }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("dismiss_pro_delivery", {
    p_delivery_id: parsed.data.deliveryId,
  });
  if (error) return fail(error, "No se pudo descartar.");
  revalidatePath("/perfil/profesional");
  revalidatePath("/perfil/bandeja");
  return { ok: true, data: null };
}
