"use client";

import { useState, useTransition } from "react";
import { PillButton } from "@/components/shared/pill-button";
import { DELETE_PHRASE } from "@/lib/account/constants";
import { deleteAccount } from "@/lib/account/actions";

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open)
    return (
      <PillButton variant="outline" fullWidth onClick={() => setOpen(true)}>
        Borrar mi cuenta
      </PillButton>
    );

  return (
    <section
      className="flex flex-col gap-3 rounded-2xl border border-danger-soft/60 p-4"
      aria-label="Borrar mi cuenta"
    >
      <p className="text-sm">
        Se borran tu perfil alimentario, tus planes de alimentación, tus archivos y tu usuario. Las
        recetas que cargaste en grupos compartidos quedan en el grupo, y si sos dueño pasa a otra
        persona. <strong>No se puede deshacer.</strong>
      </p>
      <label htmlFor="delete-confirm" className="text-sm font-medium">
        Para confirmar, escribí «{DELETE_PHRASE}»
      </label>
      <input
        id="delete-confirm"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoComplete="off"
        className="min-h-12 rounded-full border border-border bg-surface px-4 text-[15px] outline-none"
      />
      {error ? (
        <p role="alert" className="text-sm text-danger-soft">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <PillButton
          className="flex-1"
          disabled={pending || text.trim().toUpperCase() !== DELETE_PHRASE}
          onClick={() =>
            start(async () => {
              const res = await deleteAccount({ confirm: text });
              if (res && !res.ok) setError(res.error);
            })
          }
        >
          Borrar definitivamente
        </PillButton>
        <PillButton
          variant="outline"
          className="flex-1"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          Cancelar
        </PillButton>
      </div>
    </section>
  );
}
