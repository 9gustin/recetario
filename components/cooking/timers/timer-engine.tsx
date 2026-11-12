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
