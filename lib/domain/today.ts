import { slotOrder, type MealSlot } from "./meal-slots";
import { DEFAULT_TIMEZONE } from "./week";

export type TodayEntry = {
  id: string;
  date: string;
  slot: MealSlot;
  title: string;
  recipeId: string | null;
  isLeftover: boolean;
  imageUrl: string | null;
  totalMinutes: number | null;
};

export type PrepTask = { id: string; title: string; time?: string | null };

export type AgendaItem =
  | { kind: "meal"; id: string; time: string; entry: TodayEntry }
  | { kind: "task"; id: string; time: string | null; title: string };

export type TodayState = "planned" | "unplanned" | "done_for_today";

export type TodayResolution = {
  state: TodayState;
  nextMeal: TodayEntry | null;
  agenda: AgendaItem[];
  tomorrow: TodayEntry[];
};

/** Hora aproximada a la que se come cada momento (se usa para ordenar la agenda). */
export const SLOT_TIME: Record<MealSlot, string> = {
  breakfast: "08:00",
  lunch: "13:00",
  merienda: "17:00",
  dinner: "21:00",
  snack: "23:00",
};

/** Hora (0–23) de un instante en la zona horaria dada. */
export function hourIn(now: Date, tz: string = DEFAULT_TIMEZONE): number {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" })
    .format(now)
    .slice(0, 2);
  return Number(h) % 24;
}

/**
 * Qué mostrar en "Hoy". Antes de las 15 h la próxima comida es el almuerzo (o lo que siga);
 * desde las 15 h, la cena. Lo que ya se cocinó (`doneIds`) se saltea.
 */
export function resolveToday(input: {
  hour: number;
  today: string;
  tomorrow: string;
  entries: TodayEntry[];
  prepTasks?: PrepTask[];
  doneIds?: string[];
}): TodayResolution {
  const done = new Set(input.doneIds ?? []);
  const todays = input.entries
    .filter((e) => e.date === input.today)
    .sort((a, b) => slotOrder(a.slot) - slotOrder(b.slot));
  const tomorrow = input.entries
    .filter((e) => e.date === input.tomorrow)
    .sort((a, b) => slotOrder(a.slot) - slotOrder(b.slot));

  if (todays.length === 0) {
    return { state: "unplanned", nextMeal: null, agenda: [], tomorrow };
  }

  const threshold = input.hour < 15 ? slotOrder("lunch") : slotOrder("dinner");
  const nextMeal = todays.find((e) => slotOrder(e.slot) >= threshold && !done.has(e.id)) ?? null;

  const agenda: AgendaItem[] = [
    ...todays
      .filter((e) => e.id !== nextMeal?.id && !done.has(e.id) && slotOrder(e.slot) >= threshold)
      .map((e) => ({ kind: "meal" as const, id: e.id, time: SLOT_TIME[e.slot], entry: e })),
    ...(input.prepTasks ?? []).map((t) => ({
      kind: "task" as const,
      id: t.id,
      time: t.time ?? null,
      title: t.title,
    })),
  ].sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));

  return { state: nextMeal ? "planned" : "done_for_today", nextMeal, agenda, tomorrow };
}
