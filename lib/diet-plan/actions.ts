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
