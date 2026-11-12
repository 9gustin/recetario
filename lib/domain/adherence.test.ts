import { describe, expect, it } from "vitest";
import { recentWeeks, todayPlan, weekAdherence, type MealLog, type PlanMeal } from "./adherence";

// Semana lunes 2026-11-16 → domingo 2026-11-22.
const WEEK = "2026-11-16";
const meals: PlanMeal[] = [
  { id: "m1", slot: "lunch", formula: "Proteína + verdura" },
  { id: "m2", slot: "dinner", formula: "Sin harinas" },
];
const log = (date: string, slot: MealLog["slot"], status: MealLog["status"]): MealLog => ({
  date,
  slot,
  status,
});

describe("weekAdherence", () => {
  it("semana completa cumplida = 100 %", () => {
    const days = ["16", "17", "18", "19", "20", "21", "22"];
    const logs = days.flatMap((d) => [
      log(`2026-11-${d}`, "lunch", "followed"),
      log(`2026-11-${d}`, "dinner", "followed"),
    ]);
    const r = weekAdherence(logs, { meals, allowancesPerWeek: 3 }, WEEK, "2026-11-22");
    expect(r.percent).toBe(100);
    expect(r.pending).toBe(0);
    expect(r.grid).toHaveLength(2);
    expect(r.grid[0]!.cells).toHaveLength(7);
  });

  it("'cambié algo' cuenta medio y salteado, cero", () => {
    const logs = [
      log("2026-11-16", "lunch", "followed"),
      log("2026-11-16", "dinner", "changed"),
      log("2026-11-17", "lunch", "skipped"),
    ];
    const r = weekAdherence(logs, { meals, allowancesPerWeek: 3 }, WEEK, "2026-11-17");
    // puntos 1 + 0,5 + 0 sobre 4 esperadas (hasta el martes: 4 comidas, 1 pendiente).
    expect(r.percent).toBe(38);
    expect(r.pending).toBe(1);
  });

  it("permitidos dentro del tope cuentan como cumplidos; los que lo superan, no", () => {
    const logs = [
      log("2026-11-16", "lunch", "allowance"),
      log("2026-11-16", "dinner", "allowance"),
      log("2026-11-17", "lunch", "allowance"),
    ];
    const plan = { meals, allowancesPerWeek: 2 };
    const r = weekAdherence(logs, plan, WEEK, "2026-11-17");
    expect(r.allowancesUsed).toBe(3);
    expect(r.allowancesLeft).toBe(0);
    // 2 de 3 dentro del tope, más 1 pendiente (cena del 17) → 2/4.
    expect(r.percent).toBe(50);
  });

  it("quedan permitidos disponibles", () => {
    const r = weekAdherence(
      [log("2026-11-16", "lunch", "allowance")],
      { meals, allowancesPerWeek: 3 },
      WEEK,
      "2026-11-16",
    );
    expect(r.allowancesLeft).toBe(2);
  });

  it("sin nada registrado ni vencido el porcentaje es 0 y no hay pendientes futuros", () => {
    const r = weekAdherence([], { meals, allowancesPerWeek: 3 }, WEEK, "2026-11-10");
    expect(r).toMatchObject({ percent: 0, pending: 0 });
  });

  it("respeta los días específicos de cada comida", () => {
    const onlyWeekend: PlanMeal[] = [{ slot: "dinner", formula: "Libre", days: [6, 0] }];
    const r = weekAdherence([], { meals: onlyWeekend, allowancesPerWeek: 0 }, WEEK, "2026-11-22");
    expect(r.pending).toBe(2);
    expect(r.grid[0]!.cells.filter((c) => c.expected).map((c) => c.date)).toEqual([
      "2026-11-21",
      "2026-11-22",
    ]);
  });

  it("un registro en un día que no tocaba también se cuenta", () => {
    const onlyWeekend: PlanMeal[] = [{ slot: "dinner", formula: "Libre", days: [6] }];
    const r = weekAdherence(
      [log("2026-11-16", "dinner", "followed")],
      { meals: onlyWeekend, allowancesPerWeek: 0 },
      WEEK,
      "2026-11-16",
    );
    expect(r.percent).toBe(100);
  });
});

describe("todayPlan", () => {
  const plan = {
    meals: [
      { id: "m2", slot: "dinner" as const, formula: "Sin harinas" },
      { id: "m1", slot: "breakfast" as const, formula: "Lácteo + fruta", days: [1] },
      { id: "m3", slot: "lunch" as const, formula: "Proteína", days: [] },
    ],
    swaps: [
      { mealId: "m1", original: "yogur", replacement: "queso fresco" },
      { mealId: null, original: "pan", replacement: "tostadas" },
    ],
  };

  it("filtra por día, ordena por momento y aplica reemplazos y registros", () => {
    const r = todayPlan(plan, "2026-11-16", [log("2026-11-16", "lunch", "followed")]); // lunes
    expect(r.map((m) => m.slot)).toEqual(["breakfast", "lunch", "dinner"]);
    expect(r[0]!.replacements.map((s) => s.replacement)).toEqual(["queso fresco", "tostadas"]);
    expect(r[1]!.logged).toBe("followed");
    expect(r[2]!.logged).toBeNull();
  });

  it("un día que no toca el desayuno lo omite; sin swaps no falla", () => {
    const r = todayPlan({ meals: plan.meals }, "2026-11-17");
    expect(r.map((m) => m.slot)).toEqual(["lunch", "dinner"]);
    expect(r[0]!.replacements).toEqual([]);
  });
});

describe("recentWeeks", () => {
  it("devuelve las últimas semanas, la actual primero", () => {
    expect(recentWeeks(WEEK, 3)).toEqual(["2026-11-16", "2026-11-09", "2026-11-02"]);
  });
});
