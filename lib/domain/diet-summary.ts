import type { WeekAdherence } from "./adherence";
import { slotLabel } from "./meal-slots";
import { dayLabel } from "./week";

const MARK = { followed: "✅", changed: "🟡", allowance: "🎉", skipped: "⬜" } as const;

/** Resumen de la semana en texto para mandarle a la nutricionista. */
export function summarizeWeek(title: string, weekStart: string, a: WeekAdherence): string {
  const lines = a.grid.map((row) => {
    const cells = row.cells
      .filter((c) => c.expected || c.status)
      .map((c) => `${dayLabel(c.date).split(" ")[0]} ${c.status ? MARK[c.status] : "·"}`);
    return `${slotLabel(row.slot)}: ${cells.join("  ")}`;
  });
  return [
    `📋 ${title} · semana del ${dayLabel(weekStart)}`,
    `Cumplido: ${a.percent}%`,
    `Permitidos usados: ${a.allowancesUsed} (quedan ${a.allowancesLeft})`,
    "",
    ...lines,
  ].join("\n");
}

/** Mensaje corto y positivo según cómo viene la semana. */
export function encouragement(a: WeekAdherence): string {
  const left =
    a.allowancesLeft === 1 ? "Te queda 1 permitido" : `Te quedan ${a.allowancesLeft} permitidos`;
  if (a.percent >= 80) return `Vas muy bien. ${left} hasta el domingo.`;
  if (a.percent >= 50) return `Vas bien, seguí así. ${left} hasta el domingo.`;
  return `Cada comida suma: mañana arrancás de nuevo. ${left} hasta el domingo.`;
}
