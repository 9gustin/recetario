"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PillButton } from "@/components/shared/pill-button";
import { updateDisplayName } from "@/lib/profile/actions";

export function EditNameForm({ currentName }: { currentName: string }) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateDisplayName({ displayName: name });
      if (res.ok) setSaved(true);
      else setError(res.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="display-name">Nombre</Label>
        <Input
          id="display-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          className="min-h-[54px] rounded-2xl border-border bg-surface px-4 text-base"
        />
      </div>
      {error ? <p className="text-sm font-medium text-danger-soft">{error}</p> : null}
      {saved ? <p className="text-sm font-medium text-success">Nombre guardado.</p> : null}
      <PillButton type="submit" disabled={isPending}>
        {isPending ? "Guardando…" : "Guardar"}
      </PillButton>
    </form>
  );
}
