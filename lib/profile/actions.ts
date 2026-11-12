"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

const Input = z.object({
  displayName: z.string().trim().min(1, "Escribí un nombre").max(60),
});

export async function updateDisplayName(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Escribí un nombre." };

  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName })
    .eq("id", user.id);

  if (error) return { ok: false, error: "No se pudo guardar." };

  revalidatePath("/perfil");
  return { ok: true };
}
