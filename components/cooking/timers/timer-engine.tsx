"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { playAlarm } from "@/lib/sound";
import { showLocalNotification } from "@/lib/notify";
import { useTimerStore, type CookTimer } from "./timer-store";

function alertFinished(timer: CookTimer, onGoToStep: (stepIndex: number) => void) {
  const message = `¡Terminó el timer del ${timer.label.toLowerCase()}!`;
  playAlarm();
  navigator.vibrate?.([300, 150, 300, 150, 300]);
  toast(message, {
    id: timer.id,
    duration: Infinity,
    closeButton: true,
    action: { label: "Ver", onClick: () => onGoToStep(timer.stepIndex) },
  });
  void showLocalNotification("Recetario", message, timer.id);
}

/**
 * Sin interfaz: rehidrata los timers guardados, revisa cada segundo (y al volver a la app) cuáles
 * terminaron y avisa con sonido, vibración, toast persistente y notificación.
 */
export function TimerEngine({ onGoToStep }: { onGoToStep: (stepIndex: number) => void }) {
  // Timers pasivos de más de 5 minutos: se programa un push por si la app queda en segundo plano.
  useEffect(() => {
    const scheduled = new Map<string, number>();
    return useTimerStore.subscribe((state) => {
      for (const t of Object.values(state.timers)) {
        const key = `timer:${t.id}`;
        if (t.status === "running" && t.passive && t.durationSeconds > 300 && t.endsAt) {
          if (scheduled.get(key) === t.endsAt) continue;
          scheduled.set(key, t.endsAt);
          void fetch("/api/push/timer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              key,
              fireAt: new Date(t.endsAt).toISOString(),
              title: `¡Terminó el timer del ${t.label.toLowerCase()}!`,
            }),
          }).catch(() => undefined);
        } else if (scheduled.has(key) && t.status !== "running") {
          scheduled.delete(key);
          void fetch("/api/push/timer", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key }),
          }).catch(() => undefined);
        }
      }
    });
  }, []);

  useEffect(() => {
    void Promise.resolve(useTimerStore.persist.rehydrate()).then(() => check());

    function check() {
      for (const timer of useTimerStore.getState().collectFinished())
        alertFinished(timer, onGoToStep);
    }

    const id = setInterval(check, 1000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", check);
    };
  }, [onGoToStep]);

  return null;
}
