import { describe, expect, it } from "vitest";
import { hourIn, resolveToday, type TodayEntry } from "./today";

const e = (id: string, date: string, slot: TodayEntry["slot"]): TodayEntry => ({
  id,
  date,
  slot,
  title: id,
  recipeId: id,
  isLeftover: false,
  imageUrl: null,
  totalMinutes: 20,
});

const base = { today: "2026-11-12", tomorrow: "2026-11-13" };
const lunch = e("almuerzo", base.today, "lunch");
const dinner = e("cena", base.today, "dinner");
const next = e("manana", base.tomorrow, "dinner");

describe("resolveToday", () => {
  it("sin comidas hoy está unplanned y trae lo de mañana", () => {
    const r = resolveToday({ ...base, hour: 10, entries: [next] });
    expect(r.state).toBe("unplanned");
    expect(r.nextMeal).toBeNull();
    expect(r.tomorrow).toEqual([next]);
  });

  it("antes de las 15 h la próxima comida es el almuerzo y la cena queda en la agenda", () => {
    const r = resolveToday({ ...base, hour: 14, entries: [dinner, lunch] });
    expect(r.state).toBe("planned");
    expect(r.nextMeal?.id).toBe("almuerzo");
    expect(r.agenda.map((a) => a.id)).toEqual(["cena"]);
  });

  it("desde las 15 h es la cena", () => {
    const r = resolveToday({ ...base, hour: 15, entries: [lunch, dinner] });
    expect(r.nextMeal?.id).toBe("cena");
    expect(r.agenda).toEqual([]);
  });

  it("si ya se cocinó la cena está done_for_today", () => {
    const r = resolveToday({
      ...base,
      hour: 21,
      entries: [lunch, dinner, next],
      doneIds: ["cena"],
    });
    expect(r.state).toBe("done_for_today");
    expect(r.tomorrow).toEqual([next]);
  });

  it("si se cocinó el almuerzo, sigue la cena", () => {
    const r = resolveToday({ ...base, hour: 13, entries: [lunch, dinner], doneIds: ["almuerzo"] });
    expect(r.nextMeal?.id).toBe("cena");
  });

  it("solo hay almuerzo y ya son las 18 h: done_for_today", () => {
    expect(resolveToday({ ...base, hour: 18, entries: [lunch] }).state).toBe("done_for_today");
  });

  it("mezcla tareas y comidas ordenadas por hora, las tareas sin hora al final", () => {
    const r = resolveToday({
      ...base,
      hour: 10,
      entries: [lunch, dinner],
      prepTasks: [
        { id: "t1", title: "Sacar el pollo", time: "19:00" },
        { id: "t2", title: "Cortar verduras" },
      ],
    });
    expect(r.agenda.map((a) => a.id)).toEqual(["t1", "cena", "t2"]);
  });
});

describe("hourIn", () => {
  it("convierte a la zona horaria", () => {
    expect(hourIn(new Date("2026-11-12T00:30:00Z"), "America/Argentina/Buenos_Aires")).toBe(21);
    expect(hourIn(new Date("2026-11-12T15:00:00Z"), "UTC")).toBe(15);
  });
});
