/** Agrupa las preparaciones por día con la duración total. Lógica pura. */
export type DayTask = {
  id: string;
  suggested_date: string | null;
  duration_minutes: number | null;
  kind: string;
  done_at: string | null;
};

export type DayGroup<T extends DayTask> = { date: string; tasks: T[]; totalMinutes: number };

export function groupByDay<T extends DayTask>(tasks: T[]): DayGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const t of tasks) {
    if (!t.suggested_date) continue;
    map.set(t.suggested_date, [...(map.get(t.suggested_date) ?? []), t]);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, list]) => ({
      date,
      tasks: list,
      totalMinutes: list
        .filter((t) => !t.done_at)
        .reduce((sum, t) => sum + (t.duration_minutes ?? 0), 0),
    }));
}

/** Descongelar va primero: es lo que no hay que olvidarse. */
export const sortTasks = <T extends DayTask>(tasks: T[]): T[] =>
  [...tasks].sort((a, b) => Number(b.kind === "thaw") - Number(a.kind === "thaw"));
