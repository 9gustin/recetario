"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Confirma el borrador: pasa a activo y archiva el anterior. */
export async function activateDietPlan(
  raw: unknown,
): Promise<{ ok: true; data: null } | { ok: false; error: string }> {
  const parsed = z.object({ planId: z.string().uuid() }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("activate_diet_plan", { p_plan_id: parsed.data.planId });
  if (error) return { ok: false, error: "No se pudo activar el plan." };
  revalidatePath("/perfil/plan");
  revalidatePath("/perfil");
  return { ok: true, data: null };
}

/** Registra cómo salió una comida (un toque). */
export async function logMeal(
  raw: unknown,
): Promise<{ ok: true; data: null } | { ok: false; error: string }> {
  const parsed = z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      slot: z.enum(["breakfast", "lunch", "merienda", "dinner", "snack"]),
      status: z.enum(["followed", "changed", "allowance", "skipped"]),
      note: z.string().trim().max(500).optional(),
      aiSuggested: z.string().max(20).optional(),
    })
    .safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("log_meal", {
    p_date: parsed.data.date,
    p_slot: parsed.data.slot,
    p_status: parsed.data.status,
    p_note: parsed.data.note ?? undefined,
    p_ai_suggested: parsed.data.aiSuggested ?? undefined,
  });
  if (error) return { ok: false, error: "No se pudo registrar la comida." };
  revalidatePath("/perfil/plan");
  return { ok: true, data: null };
}

/**
 * Al terminar de cocinar una comida del plan semanal: si la persona tiene plan vivo con ese momento y todavía
 * no lo registró, deja "Cumplí". Solo registra a quien cocinó (el registro de cada persona es privado).
 */
export async function autoLogFromEntry(
  raw: unknown,
): Promise<
  | { ok: true; data: { logged: boolean; date?: string; slot?: string } }
  | { ok: false; error: string }
> {
  const parsed = z.object({ entryId: z.string().uuid() }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("meal_plan_entries")
    .select("id, date, slot")
    .eq("id", parsed.data.entryId)
    .maybeSingle();
  if (!entry) return { ok: true, data: { logged: false } };
  const { data: plan } = await supabase
    .from("diet_plans")
    .select("diet_plan_meals(slot, days)")
    .eq("status", "active")
    .maybeSingle();
  const dow = new Date(`${entry.date}T00:00:00Z`).getUTCDay();
  const applies = (plan?.diet_plan_meals ?? []).some(
    (m) => m.slot === entry.slot && (!m.days || m.days.length === 0 || m.days.includes(dow)),
  );
  if (!applies) return { ok: true, data: { logged: false } };
  const { data: existing } = await supabase
    .from("meal_logs")
    .select("id")
    .eq("date", entry.date)
    .eq("slot", entry.slot)
    .maybeSingle();
  if (existing) return { ok: true, data: { logged: false } };
  const { error } = await supabase.rpc("log_meal", {
    p_date: entry.date,
    p_slot: entry.slot,
    p_status: "followed",
    p_plan_entry_id: entry.id,
  });
  if (error) return { ok: false, error: "No se pudo registrar la comida." };
  revalidatePath("/perfil/plan");
  return { ok: true, data: { logged: true, date: entry.date, slot: entry.slot } };
}

/** Deshace un registro hecho por error. */
export async function undoLog(raw: unknown): Promise<{ ok: boolean }> {
  const parsed = z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      slot: z.enum(["breakfast", "lunch", "merienda", "dinner", "snack"]),
    })
    .safeParse(raw);
  if (!parsed.success) return { ok: false };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("meal_logs")
    .delete()
    .eq("date", parsed.data.date)
    .eq("slot", parsed.data.slot);
  revalidatePath("/perfil/plan");
  return { ok: !error };
}
