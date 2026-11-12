import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { describeRestrictions } from "./profile";

describe("describeRestrictions", () => {
  it("sin restricciones no agrega nada", () => {
    expect(describeRestrictions([])).toBe("");
  });

  it("separa lo que no puede comer de lo que limita, con includes, límite y familias", () => {
    const text = describeRestrictions([
      {
        target: "cebolla",
        type: "ingredient",
        severity: "forbidden",
        includes: ["cebolla de verdeo"],
      },
      { target: "allium", type: "family", severity: "forbidden" },
      { target: "harinas", type: "category", severity: "limit", limit: "evitar en la cena" },
    ]);
    expect(text).toContain(
      "NO puede comer: cebolla (incluye cebolla de verdeo); Cebolla, ajo y puerro (allium).",
    );
    expect(text).toContain("Limita: harinas (evitar en la cena).");
  });

  it("omite la línea que no aplica", () => {
    const text = describeRestrictions([
      { target: "maní", type: "ingredient", severity: "forbidden" },
    ]);
    expect(text).toContain("NO puede comer: maní.");
    expect(text).not.toContain("Limita");
  });
});
