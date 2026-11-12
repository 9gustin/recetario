"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PillButton } from "@/components/shared/pill-button";
import { createCollection } from "@/lib/public/manage";

export function CreateCollection({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await createCollection({ groupId, title });
          if (!res.ok) return void toast.error(res.error);
          router.push(`/g/${groupId}/recetas/colecciones/${res.data.id}`);
        });
      }}
    >
      <label htmlFor="col-title" className="sr-only">
        Nombre de la colección
      </label>
      <input
        id="col-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Cenas de 20 minutos"
        className="min-h-12 min-w-0 flex-1 rounded-full border border-border bg-surface px-4 text-[15px] outline-none"
      />
      <PillButton type="submit" size="md" disabled={pending || !title.trim()}>
        Crear
      </PillButton>
    </form>
  );
}
