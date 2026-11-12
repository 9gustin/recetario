import { slotLabel } from "@/lib/domain/meal-slots";
import type { WeekAdherence } from "@/lib/domain/adherence";
import { cn } from "@/lib/utils";

const DAY = ["L", "M", "M", "J", "V", "S", "D"];
const COLOR = {
  followed: "bg-success text-background",
  changed: "bg-warning text-background",
  allowance: "bg-accent text-accent-foreground",
  skipped: "bg-danger-soft text-background",
} as const;
const LABEL = {
  followed: "Cumplí",
  changed: "Cambié algo",
  allowance: "Permitido",
  skipped: "Salteada",
} as const;

/** Momentos × días con color por estado y leyenda. */
export function WeekGrid({ adherence }: { adherence: WeekAdherence }) {
  return (
    <div className="flex flex-col gap-2">
      <table
        className="w-full table-fixed border-separate border-spacing-1 text-center"
        aria-label="Semana"
      >
        <thead>
          <tr>
            <th className="w-20" />
            {DAY.map((d, i) => (
              <th key={i} className="text-xs font-bold text-muted">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {adherence.grid.map((row) => (
            <tr key={row.slot}>
              <th className="text-left text-xs font-semibold">{slotLabel(row.slot)}</th>
              {row.cells.map((c) => (
                <td key={c.date}>
                  <span
                    role="img"
                    aria-label={`${c.date}: ${c.status ? LABEL[c.status] : c.expected ? "pendiente" : "no toca"}`}
                    className={cn(
                      "mx-auto block h-7 w-full max-w-9 rounded-md",
                      c.status
                        ? COLOR[c.status]
                        : c.expected
                          ? "border border-dashed border-border"
                          : "bg-surface-2/50",
                    )}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted" aria-label="Leyenda">
        {(Object.keys(LABEL) as (keyof typeof LABEL)[]).map((k) => (
          <li key={k} className="flex items-center gap-1.5">
            <span className={cn("size-3 rounded-sm", COLOR[k])} aria-hidden="true" /> {LABEL[k]}
          </li>
        ))}
      </ul>
    </div>
  );
}
