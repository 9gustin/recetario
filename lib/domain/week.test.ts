import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  dayLabel,
  formatWeekLabel,
  todayString,
  weekDays,
  weekStartOf,
} from "./week";
import { MEAL_SLOTS, slotLabel, sortSlots } from "./meal-slots";

describe("weekStartOf", () => {
  it("devuelve el lunes de la semana (semana que empieza el lunes)", () => {
    expect(weekStartOf("2026-11-11")).toBe("2026-11-09"); // miércoles → lunes
    expect(weekStartOf("2026-11-09")).toBe("2026-11-09"); // el propio lunes
    expect(weekStartOf("2026-11-15")).toBe("2026-11-09"); // domingo → lunes anterior
  });

  it("respeta que la semana empiece el domingo", () => {
    expect(weekStartOf("2026-11-11", 0)).toBe("2026-11-08");
    expect(weekStartOf("2026-11-15", 0)).toBe("2026-11-15");
  });

  it("usa la hora de Argentina: 23:30 del domingo allá ya es lunes en UTC pero sigue siendo domingo", () => {
    const sundayNight = new Date("2026-11-16T02:30:00Z"); // 23:30 del domingo 15 en Buenos Aires
    expect(todayString(sundayNight)).toBe("2026-11-15");
    expect(weekStartOf(sundayNight)).toBe("2026-11-09");
    const mondayMorning = new Date("2026-11-16T03:30:00Z"); // 00:30 del lunes 16 en Buenos Aires
    expect(weekStartOf(mondayMorning)).toBe("2026-11-16");
  });

  it("cruza meses y años", () => {
    expect(weekStartOf("2027-01-01")).toBe("2026-12-28");
  });
});

describe("weekDays / addDays / daysBetween", () => {
  it("arma los siete días en orden, incluso cruzando de mes", () => {
    expect(weekDays("2026-11-30")).toEqual([
      "2026-11-30",
      "2026-12-01",
      "2026-12-02",
      "2026-12-03",
      "2026-12-04",
      "2026-12-05",
      "2026-12-06",
    ]);
  });
  it("suma días con años bisiestos", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
    expect(addDays("2026-11-10", -10)).toBe("2026-10-31");
  });
  it("cuenta los días entre dos fechas", () => {
    expect(daysBetween("2026-11-09", "2026-11-16")).toBe(7);
    expect(daysBetween("2026-11-16", "2026-11-09")).toBe(-7);
  });
});

describe("etiquetas", () => {
  it("formatea la semana", () => {
    expect(formatWeekLabel("2026-11-16")).toBe("Semana del 16 al 22 de noviembre");
    expect(formatWeekLabel("2026-11-30")).toBe("Semana del 30 de noviembre al 6 de diciembre");
  });
  it("nombra el día", () => {
    expect(dayLabel("2026-11-16")).toBe("Lunes 16");
    expect(dayLabel("2026-11-22")).toBe("Domingo 22");
  });
  it("ordena y nombra los momentos", () => {
    expect(MEAL_SLOTS.map((s) => s.label)).toEqual([
      "Desayuno",
      "Almuerzo",
      "Merienda",
      "Cena",
      "Snacks",
    ]);
    expect(sortSlots(["dinner", "breakfast", "otro", "lunch"])).toEqual([
      "breakfast",
      "lunch",
      "dinner",
    ]);
    expect(slotLabel("dinner")).toBe("Cena");
    expect(slotLabel("raro")).toBe("raro");
  });
});

import { formatRangeLabel, rangeDays, rangeLength } from "./week";

describe("rangos", () => {
  it("cuenta y lista los días", () => {
    expect(rangeLength("2026-11-17", "2026-11-19")).toBe(3);
    expect(rangeDays("2026-11-30", "2026-12-02")).toEqual(["2026-11-30", "2026-12-01", "2026-12-02"]);
  });
  it("arma la etiqueta", () => {
    expect(formatRangeLabel("2026-11-16", "2026-11-22")).toBe("Semana del 16 al 22 de noviembre");
    expect(formatRangeLabel("2026-11-17", "2026-11-17")).toBe("Martes 17 de noviembre");
    expect(formatRangeLabel("2026-11-17", "2026-11-19")).toBe("17 al 19 de noviembre");
    expect(formatRangeLabel("2026-11-29", "2026-12-01")).toBe("29 de noviembre al 1 de diciembre");
  });
});
