"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PillButton } from "@/components/shared/pill-button";
import { formatRangeLabel } from "@/lib/domain/week";
import { duplicatePlan } from "@/lib/plan/actions";
import type { PlanHistoryItem } from "@/lib/plan/queries";

/** Semanas anteriores: abrir una y repetirla en la semana elegida. */
export function HistoryList({
  groupId,
  items,
  targetWeek,
}: {
  groupId: string;
  items: PlanHistoryItem[];
  targetWeek: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function repeat(planId: string) {
    start(async () => {
      const res = await duplicatePlan({ planId, groupId, weekStart: targetWeek });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Plan duplicado.");
      router.push(`/g/${groupId}/plan/${targetWeek}`);
    });
  }

  if (items.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-muted">Todavía no hay semanas anteriores.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-3 px-4 pb-8">
      {items.map((h) => (
        <li key={h.id} className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
          <Link href={`/g/${groupId}/plan/${h.week_start}`} className="flex items-center gap-3">
            <span className="flex -space-x-2" aria-hidden="true">
              {h.thumbs.length === 0 ? (
                <span className="flex size-10 items-center justify-center rounded-[10px] bg-hero">
                  🍽️
                </span>
              ) : (
                h.thumbs.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={src}
                    src={src}
                    alt=""
                    className="size-10 rounded-[10px] border-2 border-surface object-cover"
                    loading="lazy"
                  />
                ))
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">
                {formatRangeLabel(h.week_start, h.end_date)}
              </span>
              <span className="text-xs text-muted">
                {h.entryCount} comidas · {h.status === "approved" ? "Aprobado" : "Borrador"}
              </span>
            </span>
          </Link>
          <PillButton variant="soft" size="md" disabled={pending} onClick={() => repeat(h.id)}>
            Repetir esta semana
          </PillButton>
        </li>
      ))}
    </ul>
  );
}
