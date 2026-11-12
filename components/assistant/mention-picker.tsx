import { cn } from "@/lib/utils";
import type { MentionRecipe } from "@/lib/recipes/actions";

type Props = {
  results: MentionRecipe[];
  activeIndex: number;
  onPick: (recipe: MentionRecipe) => void;
  onHover: (index: number) => void;
};

/** Lista de recetas que coinciden con lo que se escribe después de "@". */
export function MentionPicker({ results, activeIndex, onPick, onHover }: Props) {
  return (
    <div
      role="listbox"
      aria-label="Recetas que coinciden"
      className="absolute right-4 bottom-[calc(100%+8px)] left-4 z-20 flex max-h-72 flex-col overflow-y-auto rounded-[18px] bg-surface-2 p-1.5 shadow-xl"
    >
      <p className="px-2.5 py-1.5 text-[11px] font-bold tracking-[0.1em] text-muted">TUS RECETAS</p>
      {results.length === 0 ? (
        <p className="px-2.5 py-3 text-sm text-muted">No encontramos recetas con ese nombre.</p>
      ) : (
        results.map((r, i) => (
          <div
            key={r.id}
            role="option"
            aria-selected={i === activeIndex}
            tabIndex={-1}
            onMouseEnter={() => onHover(i)}
            onClick={() => onPick(r)}
            className={cn(
              "flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2",
              i === activeIndex && "bg-surface",
            )}
          >
            <span className="flex size-8 flex-none items-center justify-center overflow-hidden rounded-lg bg-hero text-sm">
              {r.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.image_url} alt="" className="size-full object-cover" />
              ) : (
                <span aria-hidden="true">🍽️</span>
              )}
            </span>
            <span className="flex-1 truncate text-sm">{r.title}</span>
          </div>
        ))
      )}
    </div>
  );
}
