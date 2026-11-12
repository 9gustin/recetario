"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Marca el onboarding como visto (completo o salteado). */
export async function completeOnboarding(): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", user.id);
  revalidatePath("/", "layout");
  return { ok: !error };
}
