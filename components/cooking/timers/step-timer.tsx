"use client";

import { useState } from "react";
import { Pause, Play, Plus, RotateCcw } from "lucide-react";
import { PillButton } from "@/components/shared/pill-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatClock } from "@/lib/domain/cooking-display";
import {
  markNotificationAsked,
  requestNotificationPermission,
  shouldAskNotificationPermission,
} from "@/lib/notify";
import { unlockAudio } from "@/lib/sound";
import { remainingMs, timerId, useTimerStore } from "./timer-store";
import { useNow } from "./use-now";

type Props = {
  recipeId: string;
  stepIndex: number;
  durationSeconds: number;
  passive: boolean;
};

/** Timer de un paso: iniciar, pausar, +1 min y reiniciar. */
export function StepTimer({ recipeId, stepIndex, durationSeconds, passive }: Props) {
  const id = timerId(recipeId, stepIndex);
  const timer = useTimerStore((s) => s.timers[id]);
  const { start, pause, resume, addMinute, restart } = useTimerStore.getState();
  const now = useNow(timer?.status === "running");
  const [askOpen, setAskOpen] = useState(false);

  const remaining = timer ? remainingMs(timer, now) : durationSeconds * 1000;
  const status = timer?.status ?? "idle";

  function doStart() {
    start({ recipeId, stepIndex, label: `Paso ${stepIndex + 1}`, durationSeconds, passive });
  }

  function onStart() {
    unlockAudio(); // el navegador exige un gesto del usuario para poder sonar después
    if (shouldAskNotificationPermission()) setAskOpen(true);
    else doStart();
  }

  async function answer(accept: boolean) {
    setAskOpen(false);
    if (accept) await requestNotificationPermission();
    else markNotificationAsked();
    doStart();
  }

  const caption =
    status === "running"
      ? "En marcha"
      : status === "paused"
        ? "En pausa"
        : status === "done"
          ? "¡Listo!"
          : "Tiempo del paso";

  return (
    <div className="flex w-full flex-col gap-3 rounded-[22px] bg-surface p-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <p
            className="font-display text-[40px] leading-none tabular-nums"
            aria-live="off"
            aria-label={`Tiempo restante ${formatClock(Math.ceil(remaining / 1000))}`}
          >
            {formatClock(Math.ceil(remaining / 1000))}
          </p>
          <p
            className={
              status === "done"
                ? "mt-1 text-[13px] font-bold text-accent"
                : "mt-1 text-[13px] text-muted"
            }
          >
            {caption}
          </p>
        </div>

        {status === "idle" ? (
          <PillButton variant="inverse" size="md" onClick={onStart}>
            <Play fill="currentColor" /> Iniciar
          </PillButton>
        ) : status === "running" ? (
          <PillButton variant="inverse" size="md" onClick={() => pause(id)}>
            <Pause fill="currentColor" /> Pausar
          </PillButton>
        ) : status === "paused" ? (
          <PillButton variant="inverse" size="md" onClick={() => resume(id)}>
            <Play fill="currentColor" /> Seguir
          </PillButton>
        ) : (
          <PillButton variant="inverse" size="md" onClick={() => restart(id)}>
            <RotateCcw /> Reiniciar
          </PillButton>
        )}
      </div>

      {passive && status === "running" ? (
        <p className="text-sm text-muted">
          Podés seguir con el próximo paso: el timer queda a la vista.
        </p>
      ) : null}

      {timer ? (
        <div className="flex gap-2">
          <PillButton variant="soft" size="md" onClick={() => addMinute(id)}>
            <Plus /> 1 min
          </PillButton>
          {status !== "done" ? (
            <PillButton variant="outline" size="md" onClick={() => restart(id)}>
              <RotateCcw /> Reiniciar
            </PillButton>
          ) : null}
        </div>
      ) : null}

      <Dialog open={askOpen} onOpenChange={(open) => !open && void answer(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Te avisamos cuando termine?</DialogTitle>
            <DialogDescription>
              Te mandamos una notificación cuando se acabe el tiempo, aunque estés en otra app.
              Después el navegador te va a pedir permiso.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <PillButton variant="outline" size="md" onClick={() => void answer(false)}>
              Ahora no
            </PillButton>
            <PillButton size="md" onClick={() => void answer(true)}>
              Sí, avisame
            </PillButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
