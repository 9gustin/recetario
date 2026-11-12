"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const id = z.string().uuid();

export type PrepTaskRow = {
  id: string;
  plan_id: string;
  title: string;
  details: string | null;
  suggested_date: string | null;
  duration_minutes: number | null;
  kind: string;
  done_at: string | null;
};

export async function setPrepDone(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = z.object({ id, done: z.boolean() }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("prep_tasks")
    .update(
      parsed.data.done
        ? { done_at: new Date().toISOString(), done_by: user.id }
        : { done_at: null, done_by: null },
    )
    .eq("id", parsed.data.id);
  return error ? { ok: false, error: "No se pudo actualizar." } : { ok: true };
}

export async function moveTask(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = z.object({ id, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("prep_tasks")
    .update({ suggested_date: parsed.data.date })
    .eq("id", parsed.data.id);
  return error ? { ok: false, error: "No se pudo mover." } : { ok: true };
}

export async function deleteTask(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = z.object({ id }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("prep_tasks").delete().eq("id", parsed.data.id);
  return error ? { ok: false, error: "No se pudo borrar." } : { ok: true };
}

export async function addManualTask(
  raw: unknown,
): Promise<{ ok: true; data: PrepTaskRow } | { ok: false; error: string }> {
  const parsed = z
    .object({
      planId: id,
      title: z.string().trim().min(1).max(120),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      minutes: z.number().int().positive().max(300).optional(),
    })
    .safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Completá el nombre y el día." };
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prep_tasks")
    .insert({
      plan_id: parsed.data.planId,
      title: parsed.data.title,
      suggested_date: parsed.data.date,
      duration_minutes: parsed.data.minutes ?? null,
      kind: "batch_cook",
    })
    .select("id, plan_id, title, details, suggested_date, duration_minutes, kind, done_at")
    .single();
  if (error || !data) return { ok: false, error: "No se pudo agregar." };
  return { ok: true, data };
}
