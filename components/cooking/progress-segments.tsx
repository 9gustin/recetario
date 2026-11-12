import { cn } from "@/lib/utils";

/** Barra de progreso segmentada (como las historias): una raya por pantalla. */
export function ProgressSegments({
  total,
  index,
  completed,
}: {
  total: number;
  index: number;
  completed: Set<number>;
}) {
  return (
    <div
      role="progressbar"
      aria-label="Progreso de la receta"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={index + 1}
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1 rounded-full transition-colors",
            i === index ? "bg-foreground" : completed.has(i) ? "bg-accent" : "bg-surface-2",
          )}
        />
      ))}
    </div>
  );
}
