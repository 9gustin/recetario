import { describe, expect, it } from "vitest";
import { groupByDay, sortTasks, type DayTask } from "./prep-days";

const t = (
  id: string,
  date: string | null,
  minutes: number | null,
  kind = "cut",
  done = false,
): DayTask => ({
  id,
  suggested_date: date,
  duration_minutes: minutes,
  kind,
  done_at: done ? "x" : null,
});

describe("groupByDay", () => {
  it("agrupa por día, ordena y suma solo lo pendiente", () => {
    const g = groupByDay([
      t("a", "2026-11-16", 20),
      t("b", "2026-11-15", 30),
      t("c", "2026-11-16", 10, "cut", true),
      t("d", null, 5),
      t("e", "2026-11-15", null),
    ]);
    expect(g.map((x) => x.date)).toEqual(["2026-11-15", "2026-11-16"]);
    expect(g[0]!.totalMinutes).toBe(30);
    expect(g[1]!.totalMinutes).toBe(20);
  });
});

describe("sortTasks", () => {
  it("pone descongelar primero", () => {
    expect(sortTasks([t("a", "x", 1), t("b", "x", 1, "thaw")]).map((x) => x.id)).toEqual([
      "b",
      "a",
    ]);
  });
});
