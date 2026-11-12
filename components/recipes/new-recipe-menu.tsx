"use client";

import { useState } from "react";
import Link from "next/link";
import { Camera, ClipboardPaste, Mic, PenLine, Plus } from "lucide-react";

const OPTIONS = [
  { href: "nueva", label: "Escribirla", icon: PenLine },
  { href: "importar?modo=texto", label: "Pegar texto o link", icon: ClipboardPaste },
  { href: "importar?modo=foto", label: "Sacarle foto", icon: Camera },
  { href: "importar?modo=dictar", label: "Dictarla", icon: Mic },
] as const;

/** FAB "+" con las cuatro formas de cargar una receta. */
export function NewRecipeMenu({ groupId }: { groupId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom)+16px)] z-30 mx-auto flex max-w-md flex-col items-end gap-2 px-5">
      {open ? (
        <ul className="pointer-events-auto flex flex-col rounded-2xl border border-border bg-surface p-2 shadow-lg">
          {OPTIONS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={`/g/${groupId}/recetas/${href}`}
                className="flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold"
              >
                <Icon className="size-5 text-accent" aria-hidden="true" /> {label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        aria-label="Agregar receta"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto flex size-[60px] items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg"
      >
        <Plus
          className={open ? "size-6 rotate-45 transition-transform" : "size-6 transition-transform"}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
