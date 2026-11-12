/** Cumplimiento del plan vivo. Lógica pura, sin DB ni IA. */
import { MEAL_SLOTS, type MealSlot } from "./meal-slots";
import { addDays, dayOfWeek, weekDays } from "./week";

export type LogStatus = "followed" | "changed" | "allowance" | "skipped";

export type MealLog = { date: string; slot: MealSlot; status: LogStatus };

export type PlanMeal = {
  id?: string;
  slot: MealSlot;
  /** 0 = domingo … 6 = sábado; null/vacío = todos los días. */
  days?: number[] | null;
  formula: string;
};

export type Swap = { mealId: string | null; original: string; replacement: string };

export type AdherencePlan = { meals: PlanMeal[]; allowancesPerWeek: number };

export type Cell = { date: string; slot: MealSlot; expected: boolean; status: LogStatus | null };

export type WeekAdherence = {
  percent: number;
  /** Una fila por momento del plan y una celda por día de la semana. */
  grid: { slot: MealSlot; cells: Cell[] }[];
  allowancesUsed: number;
  allowancesLeft: number;
  /** Comidas esperadas hasta hoy que todavía no se registraron. */
  pending: number;
};

const appliesOn = (meal: PlanMeal, date: string) =>
  !meal.days || meal.days.length === 0 || meal.days.includes(dayOfWeek(date));

/**
 * % cumplido de una semana. "Cumplí" suma 1; "Cambié algo", ½; un permitido suma 1 mientras esté dentro del
 * tope semanal (si se pasa, 0); "salteé" no suma. Solo cuentan las comidas registradas o ya vencidas (≤ hoy).
 */
export function weekAdherence(
  logs: MealLog[],
  plan: AdherencePlan,
  weekStart: string,
  today: string,
): WeekAdherence {
  const days = weekDays(weekStart);
  const byKey = new Map(logs.map((l) => [`${l.date}|${l.slot}`, l.status]));
  const slots = MEAL_SLOTS.filter((s) => plan.meals.some((m) => m.slot === s.key)).map(
    (s) => s.key,
  );

  let allowancesUsed = 0;
  let points = 0;
  let counted = 0;
  let pending = 0;

  const grid = slots.map((slot) => ({
    slot,
    cells: days.map((date) => {
      const expected = plan.meals.some((m) => m.slot === slot && appliesOn(m, date));
      const status = byKey.get(`${date}|${slot}`) ?? null;
      return { date, slot, expected, status } satisfies Cell;
    }),
  }));

  // Los permitidos se asignan en orden cronológico: los primeros entran en el tope.
  const ordered = grid.flatMap((r) => r.cells).sort((a, b) => a.date.localeCompare(b.date));
  for (const cell of ordered) {
    if (!cell.expected && !cell.status) continue;
    if (cell.status === null) {
      if (cell.date <= today && cell.expected) {
        pending++;
        counted++;
      }
      continue;
    }
    counted++;
    if (cell.status === "followed") points += 1;
    else if (cell.status === "changed") points += 0.5;
    else if (cell.status === "allowance") {
      allowancesUsed++;
      if (allowancesUsed <= plan.allowancesPerWeek) points += 1;
    }
  }

  return {
    percent: counted === 0 ? 0 : Math.round((points / counted) * 100),
    grid,
    allowancesUsed,
    allowancesLeft: Math.max(0, plan.allowancesPerWeek - allowancesUsed),
    pending,
  };
}

export type TodayMeal = PlanMeal & { logged: LogStatus | null; replacements: Swap[] };

/** Comidas que tocan hoy (respetando `days`), con su registro y los reemplazos elegidos para esa comida. */
export function todayPlan(
  plan: { meals: PlanMeal[]; swaps?: Swap[] },
  date: string,
  logs: MealLog[] = [],
): TodayMeal[] {
  return plan.meals
    .filter((m) => appliesOn(m, date))
    .sort(
      (a, b) =>
        MEAL_SLOTS.findIndex((s) => s.key === a.slot) -
        MEAL_SLOTS.findIndex((s) => s.key === b.slot),
    )
    .map((m) => ({
      ...m,
      logged: logs.find((l) => l.date === date && l.slot === m.slot)?.status ?? null,
      replacements: (plan.swaps ?? []).filter((s) => s.mealId === null || s.mealId === m.id),
    }));
}

/** Primer día de cada una de las últimas `count` semanas (la actual primero). */
export function recentWeeks(weekStart: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(weekStart, -7 * i));
}
