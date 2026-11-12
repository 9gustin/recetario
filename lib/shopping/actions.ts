"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { generateShoppingLists } from "./generate";

/** Genera o actualiza la lista de compras del plan (conserva lo tachado). */
export async function generateListForPlan(
  raw: unknown,
): Promise<{ ok: true; data: { listIds: string[] } } | { ok: false; error: string }> {
  const parsed = z.object({ planId: z.string().uuid(), groupId: z.string().uuid() }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const result = await generateShoppingLists(await createClient(), parsed.data.planId);
  if (!result.ok) return result;
  revalidatePath(`/g/${parsed.data.groupId}/compras`);
  return { ok: true, data: { listIds: result.listIds } };
}
