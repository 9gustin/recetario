import { cn } from "@/lib/utils";

/** Permitidos de la semana: círculos usados/libres y cuántos quedan. */
export function Allowances({ perWeek, used }: { perWeek: number; used: number }) {
  const left = Math.max(0, perWeek - used);
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-surface p-3.5">
      <p className="text-xs font-bold tracking-wide text-muted uppercase">Permitidos</p>
      <div
        className="flex flex-wrap gap-1.5"
        role="img"
        aria-label={`${used} usados de ${perWeek}`}
      >
        {Array.from({ length: Math.max(perWeek, used) }, (_, i) => (
          <span
            key={i}
            className={cn(
              "size-5 rounded-full border-2",
              i < used ? "border-accent bg-accent" : "border-border",
            )}
          />
        ))}
      </div>
      <p className="text-sm font-semibold">{left === 1 ? "Te queda 1" : `Te quedan ${left}`}</p>
    </div>
  );
}
