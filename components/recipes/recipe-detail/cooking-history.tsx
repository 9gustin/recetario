import { Star } from "lucide-react";
import type { CookingSummary } from "@/lib/cooking/queries";

const dayFormat = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});

function Rating({ value }: { value: number | null }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1 font-semibold">
      <Star className="size-3.5 fill-accent text-accent" aria-hidden="true" />
      <span className="sr-only">Puntaje:</span> {value}
    </span>
  );
}

/** "La última vez: 12/11 · ★ 4" y las notas de las veces anteriores. */
export function CookingHistory({ summary }: { summary: CookingSummary }) {
  if (!summary.last && summary.notes.length === 0) return null;
  return (
    <section
      className="flex flex-col gap-2 rounded-[20px] bg-surface p-4"
      aria-label="Historial de cocina"
    >
      {summary.last ? (
        <p className="flex flex-wrap items-center gap-x-2 text-sm">
          <span className="font-semibold">
            La última vez: {dayFormat.format(new Date(summary.last.finished_at))}
          </span>
          <Rating value={summary.last.rating} />
          {summary.last.cooked_by ? (
            <span className="text-muted">· la hizo {summary.last.cooked_by}</span>
          ) : null}
        </p>
      ) : null}
      {summary.notes.length > 0 ? (
        <ul className="flex flex-col gap-1.5 border-t border-border pt-2 text-sm">
          {summary.notes.map((n, i) => (
            <li key={i} className="flex gap-2">
              <span className="flex-none text-muted">
                {dayFormat.format(new Date(n.finished_at))}
              </span>
              <span>{n.note}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
