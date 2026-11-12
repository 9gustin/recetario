"use client";

import { useTransition } from "react";
import { FileText, Mic, PenLine, Trash2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { deleteProfileInput } from "@/lib/food-profile/actions";
import type { ProfileSource } from "@/lib/food-profile/queries";

const dateFormat = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});
const KIND: Record<string, { icon: typeof Mic; label: string }> = {
  voice: { icon: Mic, label: "Audio" },
  text: { icon: PenLine, label: "Texto" },
  file: { icon: FileText, label: "Archivo" },
  answer: { icon: MessageSquare, label: "Respuesta" },
};

/** "Mis fuentes": lo que se cargó para armar el perfil, con opción de borrarlo. */
export function SourcesList({
  sources,
  onDeleted,
}: {
  sources: ProfileSource[];
  onDeleted: (id: string) => void;
}) {
  const [pending, start] = useTransition();
  if (sources.length === 0) return null;

  return (
    <section className="flex flex-col gap-2" aria-label="Mis fuentes">
      <h2 className="text-xs font-bold tracking-[0.1em] text-muted">MIS FUENTES</h2>
      <ul className="flex flex-col gap-2">
        {sources.map((s) => {
          const { icon: Icon, label } = KIND[s.kind] ?? KIND.text!;
          return (
            <li key={s.id} className="flex items-center gap-3 rounded-2xl bg-surface px-3 py-2.5">
              <Icon className="size-5 flex-none text-muted" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  {s.text?.trim() || (s.hasFile ? "Archivo subido" : label)}
                </p>
                <p className="text-xs text-muted">
                  {label} · {dateFormat.format(new Date(s.created_at))}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Borrar ${label.toLowerCase()} del ${dateFormat.format(new Date(s.created_at))}`}
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await deleteProfileInput({ id: s.id });
                    if (!res.ok) return void toast.error(res.error);
                    onDeleted(s.id);
                  })
                }
                className="flex size-11 flex-none items-center justify-center rounded-full"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
