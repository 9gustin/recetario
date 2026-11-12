import { Check } from "lucide-react";
import { slotLabel } from "@/lib/domain/meal-slots";
import type { TodayMeal } from "@/lib/domain/adherence";
import { cn } from "@/lib/utils";

const STATUS_LABEL = {
  followed: "Cumplí",
  changed: "Cambié algo",
  allowance: "Permitido",
  skipped: "Salteada",
} as const;

/** "Hoy toca": cada comida con su fórmula, el estado si ya se registró y lo que figura en el plan semanal. */
export function TodayPlan({
  meals,
  inPlan,
}: {
  meals: TodayMeal[];
  inPlan: Record<string, string>;
}) {
  if (meals.length === 0) return <p className="text-sm text-muted">Hoy no hay comidas del plan.</p>;
  return (
    <ul className="flex flex-col gap-2" aria-label="Hoy toca">
      {meals.map((m) => (
        <li key={m.slot} className={cn("rounded-2xl bg-surface p-3.5", m.logged && "opacity-80")}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[15px] font-semibold">{slotLabel(m.slot)}</p>
            {m.logged ? (
              <span className="flex items-center gap-1 text-xs font-bold text-success">
                <Check className="size-4" aria-hidden="true" /> {STATUS_LABEL[m.logged]}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted">{m.formula}</p>
          {inPlan[m.slot] ? (
            <p className="mt-1 text-xs font-semibold text-accent">En el plan: {inPlan[m.slot]}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
