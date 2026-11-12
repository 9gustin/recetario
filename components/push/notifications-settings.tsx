"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { PillButton } from "@/components/shared/pill-button";
import { savePrefs } from "@/lib/push/actions";
import {
  disablePush,
  enablePush,
  isSubscribed,
  pushSupport,
  type PushSupport,
} from "@/lib/push/client";
import type { Prefs } from "@/lib/domain/quiet-hours";

const KINDS: { key: "prep" | "thaw" | "timers" | "inbox"; label: string; hint: string }[] = [
  { key: "prep", label: "Preparaciones", hint: "Cortar, porcionar, cocinar en tanda" },
  { key: "thaw", label: "Descongelar", hint: "El aviso de la noche anterior" },
  { key: "timers", label: "Timers de cocina", hint: "Cuando termina un timer con la app cerrada" },
  { key: "inbox", label: "Bandeja", hint: "Recetas compartidas e invitaciones" },
];

/** Perfil → Notificaciones: explica para qué, pide permiso y deja elegir qué y cuándo. */
export function NotificationsSettings({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = useState(initial);
  const [support, setSupport] = useState<PushSupport>("unsupported");
  const [on, setOn] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    // Lectura de capacidades del navegador: solo existe en el cliente.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupport(pushSupport());
    void isSubscribed().then(setOn);
  }, []);

  function save(next: Prefs) {
    setPrefs(next);
    start(async () => {
      const res = await savePrefs(next);
      if (!res.ok) toast.error(res.error ?? "No se pudo guardar.");
    });
  }

  async function toggle() {
    if (on) {
      await disablePush();
      setOn(false);
      return;
    }
    const res = await enablePush();
    if (!res.ok) return void toast.error(res.error);
    setOn(true);
    toast.success("¡Listo! Te vamos a avisar.");
  }

  return (
    <div className="flex flex-col gap-5">
      <section
        className="flex flex-col gap-3 rounded-2xl bg-hero p-4"
        aria-label="Activar notificaciones"
      >
        <p className="text-[15px] font-semibold">Avisos en este dispositivo</p>
        <p className="text-sm">
          Te avisamos cuando hay que descongelar, preparar algo o termina un timer, aunque tengas la
          app cerrada.
        </p>
        {support === "ios-needs-install" ? (
          <p className="text-sm font-medium">
            En iPhone primero tenés que instalar la app: tocá Compartir y después «Agregar a
            inicio». Después volvé acá.
          </p>
        ) : support === "unsupported" ? (
          <p className="text-sm font-medium">Este navegador no permite notificaciones.</p>
        ) : (
          <PillButton onClick={() => void toggle()} disabled={pending}>
            {on ? "Desactivar en este dispositivo" : "Activar notificaciones"}
          </PillButton>
        )}
      </section>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Qué querés recibir</legend>
        {KINDS.map((k) => (
          <label
            key={k.key}
            className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-surface px-4"
          >
            <span>
              <span className="block text-[15px] font-semibold">{k.label}</span>
              <span className="text-xs text-muted">{k.hint}</span>
            </span>
            <input
              type="checkbox"
              checked={prefs[k.key]}
              onChange={(e) => save({ ...prefs, [k.key]: e.target.checked })}
              className="size-6"
            />
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Horario silencioso (hora de Argentina)</legend>
        <div className="flex items-center gap-2">
          <label className="flex-1 text-xs text-muted">
            Desde
            <select
              value={prefs.quiet_start ?? ""}
              onChange={(e) =>
                save({
                  ...prefs,
                  quiet_start: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-2 text-[15px] text-foreground"
            >
              <option value="">Sin horario</option>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{`${h}:00`}</option>
              ))}
            </select>
          </label>
          <label className="flex-1 text-xs text-muted">
            Hasta
            <select
              value={prefs.quiet_end ?? ""}
              onChange={(e) =>
                save({ ...prefs, quiet_end: e.target.value === "" ? null : Number(e.target.value) })
              }
              className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-2 text-[15px] text-foreground"
            >
              <option value="">Sin horario</option>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{`${h}:00`}</option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>
    </div>
  );
}
