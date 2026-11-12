"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const hour = z.number().int().min(0).max(23).nullable();

export async function savePrefs(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = z
    .object({
      prep: z.boolean(),
      thaw: z.boolean(),
      timers: z.boolean(),
      inbox: z.boolean(),
      quiet_start: hour,
      quiet_end: hour,
    })
    .safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notification_prefs")
    .upsert(
      { user_id: user.id, ...parsed.data, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  return error ? { ok: false, error: "No se pudo guardar." } : { ok: true };
}
