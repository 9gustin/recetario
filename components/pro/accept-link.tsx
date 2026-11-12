"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PillButton } from "@/components/shared/pill-button";
import { acceptLink } from "@/lib/pro/actions";

export function AcceptLink({ token, proName }: { token: string; proName: string }) {
  const router = useRouter();
  const [shareMeals, setShareMeals] = useState(false);
  const [shareNotes, setShareNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function accept() {
    setError(null);
    start(async () => {
      const res = await acceptLink({ token, shareMeals, shareNotes });
      if (!res.ok) return setError(res.error);
      router.push("/perfil/profesional");
    });
  }

  return (
    <div className="flex flex-col gap-4 px-5">
      <p className="text-[15px]">
        <strong>{proName}</strong> te invita a conectarte para enviarte planes y recetas.
      </p>
      <fieldset className="flex flex-col gap-1 rounded-[20px] border border-border bg-surface p-4">
        <legend className="px-1 text-sm font-bold">¿Qué querés compartir?</legend>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="size-5"
            checked={shareMeals}
            onChange={(e) => {
              setShareMeals(e.target.checked);
              if (!e.target.checked) setShareNotes(false);
            }}
          />
          Mi registro de comidas (qué comí y si seguí el plan)
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="size-5"
            checked={shareNotes}
            disabled={!shareMeals}
            onChange={(e) => setShareNotes(e.target.checked)}
          />
          Incluir mis notas
        </label>
        <p className="pt-1 text-xs text-muted">
          Podés cambiar esto o terminar el vínculo cuando quieras desde tu perfil. No compartimos
          nada más.
        </p>
      </fieldset>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <PillButton fullWidth disabled={pending} onClick={accept}>
        Aceptar invitación
      </PillButton>
    </div>
  );
}
