"use client";

import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatClock } from "@/lib/domain/cooking-display";
import { remainingMs, useTimerStore } from "./timer-store";
import { useNow } from "./use-now";

type Props = {
  recipeId: string;
  /** El paso que se está viendo (su timer ya aparece grande, no hace falta el chip). */
  currentStepIndex: number | null;
  onGoToStep: (stepIndex: number) => void;
};

/** Chips con los timers de otros pasos, visibles en todas las pantallas. Tocar → vuelve a ese paso. */
export function FloatingTimers({ recipeId, currentStepIndex, onGoToStep }: Props) {
  const timers = useTimerStore((s) => s.timers);
  const visible = Object.values(timers)
    .filter((t) => t.recipeId === recipeId && t.stepIndex !== currentStepIndex)
    .sort((a, b) => a.stepIndex - b.stepIndex);
  const now = useNow(visible.some((t) => t.status === "running"));

  if (visible.length === 0) return null;

  return (
    <div
      className="-mt-2 flex [scrollbar-width:none] gap-2 overflow-x-auto pb-1"
      aria-label="Timers en marcha"
    >
      {visible.map((t) => {
        const done = t.status === "done";
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onGoToStep(t.stepIndex)}
            className={cn(
              "flex min-h-11 flex-none items-center gap-2 rounded-full px-3.5 text-sm font-semibold",
              done ? "bg-accent text-accent-foreground" : "bg-hero text-foreground",
            )}
          >
            <Timer className="size-4" aria-hidden="true" />
            <span className="tabular-nums">
              {done ? "¡Listo!" : formatClock(Math.ceil(remainingMs(t, now) / 1000))}
            </span>
            <span className="text-xs font-medium opacity-80">
              {t.label}
              {t.status === "paused" ? " · en pausa" : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
