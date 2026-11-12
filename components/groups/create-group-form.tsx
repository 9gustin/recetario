"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PillButton } from "@/components/shared/pill-button";
import { EmojiGrid } from "./emoji-grid";
import { createGroup } from "@/lib/groups/actions";

export function CreateGroupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createGroup({ name, emoji });
      if (res.ok) router.push(`/g/${res.groupId}/hoy`);
      else setError(res.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="group-name">Nombre del grupo</Label>
        <Input
          id="group-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Casa"
          autoComplete="off"
          className="min-h-[54px] rounded-2xl border-border bg-surface px-4 text-base"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium leading-none">Elegí un emoji</span>
        <EmojiGrid value={emoji} onSelect={setEmoji} />
      </div>

      {error ? <p className="text-sm font-medium text-danger-soft">{error}</p> : null}

      <PillButton type="submit" fullWidth disabled={isPending || !name.trim()}>
        {isPending ? "Creando…" : "Crear grupo"}
      </PillButton>
    </form>
  );
}
