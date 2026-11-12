"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PillButton } from "@/components/shared/pill-button";
import { copyPublicPlan } from "@/lib/public/actions";
import type { GroupOption } from "./save-recipe";

/** "Usar este plan": elige grupo y semana y lo copia como borrador (con sus recetas guardadas). */
export function UsePlan({
  slug,
  groups,
  nextWeek,
}: {
  slug: string;
  groups: GroupOption[] | null;
  nextWeek: string;
}) {
  const router = useRouter();
  const [groupId, setGroupId] = useState(groups?.[0]?.id ?? "");
  const [week, setWeek] = useState(nextWeek);
  const [pending, start] = useTransition();

  if (!groups)
    return (
      <PillButton asChild fullWidth>
        <Link href={`/login?next=${encodeURIComponent(`/plan-publico/${slug}`)}`}>
          Entrá para usar este plan
        </Link>
      </PillButton>
    );

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-hero p-4">
      <p className="text-[15px] font-semibold">Usar este plan</p>
      {groups.length > 1 ? (
        <>
          <label htmlFor="plan-group" className="text-sm">
            Grupo
          </label>
          <select
            id="plan-group"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="min-h-12 rounded-xl border border-border bg-background px-3 text-[15px]"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.emoji ?? "🏠"} {g.name}
              </option>
            ))}
          </select>
        </>
      ) : null}
      <label htmlFor="plan-week" className="text-sm">
        Semana que empieza el
      </label>
      <input
        id="plan-week"
        type="date"
        value={week}
        onChange={(e) => setWeek(e.target.value)}
        className="min-h-12 rounded-xl border border-border bg-background px-3 text-[15px]"
      />
      <PillButton
        disabled={pending || !groupId || !week}
        onClick={() =>
          start(async () => {
            const res = await copyPublicPlan({ slug, groupId, weekStart: week });
            if (!res.ok) return void toast.error(res.error);
            toast.success("Plan copiado como borrador.");
            router.push(`/g/${groupId}/plan/${week}`);
          })
        }
      >
        Copiar a mi plan
      </PillButton>
    </div>
  );
}
