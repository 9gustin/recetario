"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { enrichShoppingList } from "@/lib/ai/shopping/enrich";
import { checkQuota } from "@/lib/ai/rate-limit";
import { generateShoppingLists } from "./generate";

/** Genera o actualiza la lista de compras del plan (conserva lo tachado). */
export async function generateListForPlan(
  raw: unknown,
): Promise<{ ok: true; data: { listIds: string[] } } | { ok: false; error: string }> {
  const parsed = z.object({ planId: z.string().uuid(), groupId: z.string().uuid() }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  const user = await requireUser();
  const supabase = await createClient();
  const result = await generateShoppingLists(supabase, parsed.data.planId);
  if (!result.ok) return result;
  // La lista ya se ve; los consejos de compra y vida útil llegan después por realtime.
  after(async () => {
    try {
      if (!(await checkQuota(user.id, "ideas"))) return;
      for (const listId of result.listIds)
        await enrichShoppingList(supabase, {
          listId,
          userId: user.id,
          groupId: parsed.data.groupId,
        });
    } catch {
      // Es un extra: si falla, la lista funciona igual.
    }
  });
  revalidatePath(`/g/${parsed.data.groupId}/compras`);
  return { ok: true, data: { listIds: result.listIds } };
}
