import { describe, expect, it } from "vitest";
import { weekAdherence } from "./adherence";
import { encouragement, summarizeWeek } from "./diet-summary";

const a = weekAdherence(
  [{ date: "2026-11-16", slot: "dinner", status: "followed" }],
  { meals: [{ slot: "dinner", formula: "x" }], allowancesPerWeek: 3 },
  "2026-11-16",
  "2026-11-16",
);

describe("diet summary", () => {
  it("resume la semana con porcentaje y permitidos", () => {
    const text = summarizeWeek("Mi plan", "2026-11-16", a);
    expect(text).toContain("Cumplido: 100%");
    expect(text).toContain("Permitidos usados: 0 (quedan 3)");
    expect(text).toContain("Cena:");
    expect(text).toContain("✅");
  });
  it("mensajes según el porcentaje", () => {
    expect(encouragement({ ...a, percent: 90, allowancesLeft: 2 })).toBe(
      "Vas muy bien. Te quedan 2 permitidos hasta el domingo.",
    );
    expect(encouragement({ ...a, percent: 60, allowancesLeft: 1 })).toBe(
      "Vas bien, seguí así. Te queda 1 permitido hasta el domingo.",
    );
    expect(encouragement({ ...a, percent: 10, allowancesLeft: 0 })).toContain(
      "mañana arrancás de nuevo",
    );
  });
});
