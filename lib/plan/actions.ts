"use server";

import { logEvent } from "@/lib/activity/log";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { addDays } from "@/lib/domain/week";
import { displayName, notifyGroup } from "@/lib/inbox/notify";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { ENTRY_COLUMNS, getPlanEntries, toPlanEntry } from "./queries";
import type { PlanEntry } from "./types";

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const slot = z.enum(["breakfast", "lunch", "merienda", "dinner", "snack"]);

const PG_MESSAGES: Record<string, string> = {
  "23505": "Ya hay un plan que empieza ese día.",
  "23514": "Ese momento no está habilitado en este grupo.",
};

const fail = (e: { code?: string } | null, fallback: string): Result<never> => ({
  ok: false,
  error: (e?.code && PG_MESSAGES[e.code]) || fallback,
});

/** Crea el plan (borrador) de una semana. */
export async function createPlan(raw: unknown): Promise<Result<{ id: string }>> {
  const parsed = z.object({ groupId: uuid, weekStart: date, days: z.number().int().min(1).max(14).optional() }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_plans")
    .insert({
      group_id: parsed.data.groupId,
      week_start: parsed.data.weekStart,
      end_date: addDays(parsed.data.weekStart, (parsed.data.days ?? 7) - 1),
    })
    .select("id")
    .single();
  if (error || !data) return fail(error, "No se pudo crear el plan.");
  revalidatePath(`/g/${parsed.data.groupId}/plan`);
  return { ok: true, data: { id: data.id } };
}

const addSchema = z
  .object({
    planId: uuid,
    date,
    slot,
    recipeId: uuid.optional(),
    freeText: z.string().trim().min(1).max(200).optional(),
    servings: z.number().positive().max(100).optional(),
    dinerIds: z.array(uuid).max(30).optional(),
  })
  .refine((v) => v.recipeId || v.freeText, { message: "Elegí una receta o escribí algo." });

/** Agrega una comida al plan (por defecto, para todos los miembros). */
export async function addEntry(raw: unknown): Promise<Result<PlanEntry>> {
  const parsed = addSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const input = parsed.data;
  await requireUser();
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("meal_plans")
    .select("group_id")
    .eq("id", input.planId)
    .maybeSingle();
  if (!plan) return { ok: false, error: "No encontramos el plan." };

  let dinerIds = input.dinerIds;
  if (!dinerIds) {
    const { data: members } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", plan.group_id);
    dinerIds = (members ?? []).map((m) => m.user_id);
  }
  let servings = input.servings;
  if (!servings && input.recipeId) {
    const { data: recipe } = await supabase
      .from("recipes")
      .select("servings")
      .eq("id", input.recipeId)
      .maybeSingle();
    servings = recipe ? Number(recipe.servings) : undefined;
  }
  const { data: last } = await supabase
    .from("meal_plan_entries")
    .select("position")
    .eq("plan_id", input.planId)
    .eq("date", input.date)
    .eq("slot", input.slot)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("meal_plan_entries")
    .insert({
      plan_id: input.planId,
      date: input.date,
      slot: input.slot,
      recipe_id: input.recipeId ?? null,
      free_text: input.freeText ?? null,
      servings: servings ?? null,
      diner_ids: dinerIds,
      position: (last?.position ?? -1) + 1,
    })
    .select(ENTRY_COLUMNS)
    .single();
  if (error || !data) return fail(error, "No se pudo agregar la comida.");
  return { ok: true, data: toPlanEntry(data as never) };
}

const updateSchema = z.object({
  id: uuid,
  patch: z.object({
    servings: z.number().positive().max(100).nullable().optional(),
    dinerIds: z.array(uuid).max(30).optional(),
    leftoversOfEntryId: uuid.nullable().optional(),
    cookDate: date.nullable().optional(),
    freeText: z.string().trim().max(200).nullable().optional(),
    date: date.optional(),
    slot: slot.optional(),
  }),
});

/** Edita una comida (porciones, quiénes comen, sobras, día de cocción, notas). */
export async function updateEntry(raw: unknown): Promise<Result<PlanEntry>> {
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const p = parsed.data.patch;
  const update: Database["public"]["Tables"]["meal_plan_entries"]["Update"] = {};
  if (p.servings !== undefined) update.servings = p.servings;
  if (p.dinerIds !== undefined) update.diner_ids = p.dinerIds;
  if (p.leftoversOfEntryId !== undefined) update.leftovers_of_entry_id = p.leftoversOfEntryId;
  if (p.cookDate !== undefined) update.cook_date = p.cookDate;
  if (p.freeText !== undefined) update.free_text = p.freeText || null;
  if (p.date !== undefined) update.date = p.date;
  if (p.slot !== undefined) update.slot = p.slot;
  const { data, error } = await supabase
    .from("meal_plan_entries")
    .update(update)
    .eq("id", parsed.data.id)
    .select(ENTRY_COLUMNS)
    .single();
  if (error || !data) return fail(error, "No se pudo guardar el cambio.");
  return { ok: true, data: toPlanEntry(data as never) };
}

/** Quita una comida del plan. */
export async function removeEntry(raw: unknown): Promise<Result> {
  const parsed = z.object({ id: uuid }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("meal_plan_entries").delete().eq("id", parsed.data.id);
  if (error) return { ok: false, error: "No se pudo quitar la comida." };
  return { ok: true, data: null };
}

/** Aprueba el plan: las recetas nuevas pasan al recetario. */
export async function approvePlan(raw: unknown): Promise<Result> {
  const parsed = z.object({ planId: uuid, groupId: uuid }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_plan", { p_plan_id: parsed.data.planId });
  if (error) return { ok: false, error: "No se pudo aprobar el plan." };
  void logEvent(user.id, { kind: "plan_approved", groupId: parsed.data.groupId });
  void displayName(user.id).then((name) =>
    notifyGroup({
      groupId: parsed.data.groupId,
      fromUserId: user.id,
      kind: "plan_approved",
      message: `${name} aprobó el plan de la semana`,
      url: `/g/${parsed.data.groupId}/plan`,
    }),
  );
  revalidatePath(`/g/${parsed.data.groupId}/plan`);
  revalidatePath(`/g/${parsed.data.groupId}/recetas`);
  return { ok: true, data: null };
}

/** Copia un plan a otra semana (fechas corridas, sobras reenlazadas). */
export async function duplicatePlan(raw: unknown): Promise<Result<{ id: string }>> {
  const parsed = z.object({ planId: uuid, groupId: uuid, weekStart: date }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("duplicate_plan", {
    p_plan_id: parsed.data.planId,
    p_week_start: parsed.data.weekStart,
  });
  if (error || !data) return fail(error, "No se pudo duplicar el plan.");
  revalidatePath(`/g/${parsed.data.groupId}/plan`);
  return { ok: true, data: { id: data } };
}

/** Vuelve a leer las entradas de un plan (lo usa el tiempo real tras un cambio ajeno). */
export async function fetchPlanEntries(planId: string): Promise<PlanEntry[]> {
  if (!uuid.safeParse(planId).success) return [];
  await requireUser();
  return getPlanEntries(planId);
}

/** Descarta el borrador del plan: se borra el plan y las recetas nuevas que la IA propuso para él. */
export async function discardPlan(raw: unknown): Promise<Result> {
  const parsed = z.object({ planId: uuid, groupId: uuid }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("meal_plans")
    .select("status")
    .eq("id", parsed.data.planId)
    .maybeSingle();
  if (!plan) return { ok: false, error: "No encontramos el plan." };
  if (plan.status === "approved")
    return { ok: false, error: "Un plan aprobado no se puede descartar." };
  // Solo las recetas en borrador atadas a este plan (las que ya estaban en el recetario no se tocan).
  await supabase
    .from("recipes")
    .delete()
    .eq("status", "draft")
    .eq("draft_for_plan_id", parsed.data.planId);
  const { error } = await supabase.from("meal_plans").delete().eq("id", parsed.data.planId);
  if (error) return fail(error, "No se pudo descartar el plan.");
  revalidatePath(`/g/${parsed.data.groupId}/plan`);
  return { ok: true, data: null };
}
