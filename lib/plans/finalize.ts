import type { SupabaseClient } from "@supabase/supabase-js";
import { enrichShoppingList } from "@/lib/ai/shopping/enrich";
import type { StreamEvent } from "@/lib/ai/stream";
import { ensureStorageInfo } from "@/lib/ai/storage/generate";
import { generatePrepTasks } from "@/lib/ai/prep/generate";
import { generateShoppingLists } from "@/lib/shopping/generate";
import type { Database } from "@/lib/supabase/database.types";

export type FinalizeStep = {
  name: string;
  label: string;
  /** Si es true y falla, no se sigue con los pasos que dependen de él. */
  critical: boolean;
  run: (ctx: FinalizeCtx) => Promise<void>;
};

export type FinalizeCtx = {
  supabase: SupabaseClient<Database>;
  userId: string;
  groupId: string;
  planId: string;
  listIds: string[];
};

/** Pasos post-aprobación; cada uno es idempotente (regenerar fusiona sin duplicar). */
export const FINALIZE_STEPS: FinalizeStep[] = [
  {
    name: "shopping-list",
    label: "Armando la lista de compras",
    critical: true,
    async run(ctx) {
      const res = await generateShoppingLists(ctx.supabase, ctx.planId);
      if (!res.ok) throw new Error(res.error);
      ctx.listIds = res.listIds;
    },
  },
  {
    name: "enrich-list",
    label: "Sumando consejos de compra",
    critical: false,
    async run(ctx) {
      for (const listId of ctx.listIds)
        await enrichShoppingList(ctx.supabase, {
          listId,
          userId: ctx.userId,
          groupId: ctx.groupId,
        });
    },
  },
  {
    name: "storage-info",
    label: "Anotando cuánto dura cada comida",
    critical: false,
    async run(ctx) {
      await ensureStorageInfo(ctx.supabase, {
        planId: ctx.planId,
        userId: ctx.userId,
        groupId: ctx.groupId,
      });
    },
  },
  {
    name: "prep-tasks",
    label: "Pensando qué preparar con anticipación",
    critical: false,
    async run(ctx) {
      const res = await generatePrepTasks(ctx.supabase, {
        planId: ctx.planId,
        userId: ctx.userId,
        groupId: ctx.groupId,
      });
      if (!res.ok) throw new Error(res.error);
    },
  },
];

/** Corre los pasos en orden y emite un evento por paso. Un fallo no crítico no corta el resto. */
export async function runFinalize(
  ctx: FinalizeCtx,
  emit: (event: StreamEvent) => void,
  steps: FinalizeStep[] = FINALIZE_STEPS,
  only?: string[],
): Promise<{ failed: string[] }> {
  const failed: string[] = [];
  for (const step of steps) {
    if (only && !only.includes(step.name)) continue;
    emit({ type: "step", name: step.name, status: "started", detail: step.label });
    try {
      await step.run(ctx);
      emit({ type: "step", name: step.name, status: "done" });
    } catch (e) {
      failed.push(step.name);
      emit({
        type: "step",
        name: step.name,
        status: "error",
        detail: e instanceof Error ? e.message : "error",
      });
      if (step.critical) break;
    }
  }
  emit(
    failed.length
      ? { type: "error", message: "Algunos pasos fallaron. Podés reintentar." }
      : { type: "done" },
  );
  return { failed };
}
