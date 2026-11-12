import { cn } from "@/lib/utils";
import { dayLabel } from "@/lib/domain/week";
import { slotLabel } from "@/lib/domain/meal-slots";
import type { PlanEntry, PlanMember } from "@/lib/plan/types";

type Props = {
  entry: PlanEntry;
  members: PlanMember[];
  /** Entrada de la que esta es sobra (para mostrar "sobras del …"). */
  leftoverOf?: PlanEntry;
  highlighted?: boolean;
  onOpen: () => void;
};

const WEEKDAY = (date: string) => dayLabel(date).split(" ")[0]?.toLowerCase();

/** Una comida dentro de un día: miniatura, título, momento y chips (sobras, día de cocción, nueva). */
export function EntryRow({ entry, members, leftoverOf, highlighted, onOpen }: Props) {
  const title = entry.recipe?.title ?? entry.free_text ?? "Sin nombre";
  const notAll =
    members.length > 0 && entry.diner_ids.length > 0 && entry.diner_ids.length < members.length;
  const diners = notAll ? members.filter((m) => entry.diner_ids.includes(m.id)) : [];
  const details = [
    slotLabel(entry.slot),
    entry.servings ? `${entry.servings} ${entry.servings === 1 ? "porción" : "porciones"}` : null,
    entry.recipe?.total_minutes ? `${entry.recipe.total_minutes} min` : null,
  ].filter(Boolean);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-2xl bg-surface px-3 py-2.5 text-left",
        entry.recipe ? "" : "border border-dashed border-border bg-transparent",
        highlighted && "ring-2 ring-accent",
      )}
    >
      <span
        className="flex size-10 flex-none items-center justify-center overflow-hidden rounded-[10px] bg-hero text-lg"
        aria-hidden="true"
      >
        {entry.recipe?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.recipe.image_url}
            alt=""
            className="size-full object-cover"
            loading="lazy"
          />
        ) : entry.recipe ? (
          "🍽️"
        ) : (
          "·"
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted">
          <span>{details.join(" · ")}</span>
          {entry.is_new_recipe || entry.recipe?.status === "draft" ? (
            <span className="font-bold text-accent">· Nueva</span>
          ) : null}
          {leftoverOf ? <span>· sobras del {WEEKDAY(leftoverOf.date)}</span> : null}
          {entry.cook_date && entry.cook_date !== entry.date ? (
            <span>· se cocina el {WEEKDAY(entry.cook_date)}</span>
          ) : null}
        </span>
      </span>
      {diners.length > 0 ? (
        <span
          className="flex flex-none -space-x-1.5"
          aria-label={`Comen: ${diners.map((d) => d.name).join(", ")}`}
        >
          {diners.slice(0, 3).map((d) => (
            <span
              key={d.id}
              className="flex size-6 items-center justify-center rounded-full border-2 border-surface bg-hero text-[11px] font-bold"
            >
              {d.name.slice(0, 1).toUpperCase()}
            </span>
          ))}
        </span>
      ) : null}
    </button>
  );
}
