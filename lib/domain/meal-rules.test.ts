import { describe, expect, it } from "vitest";
import {
  excludedGroups,
  mismatchedGroups,
  recipeGroups,
  rulesFor,
  type MealRule,
} from "./meal-rules";
import { dayOfWeek } from "./week";

describe("excludedGroups", () => {
  it("lee 'sin harinas' de la fórmula", () => {
    expect(excludedGroups("Proteína + verduras, sin harinas", [])).toEqual(["carbohidrato"]);
  });
  it("lee componentes con allowed=false, con o sin acentos", () => {
    expect(
      excludedGroups("Libre", [{ group: "lácteos", allowed: false }, { group: "proteina" }]),
    ).toEqual(["lacteo"]);
    expect(excludedGroups("Libre", [{ group: "lacteos", allowed: false }])).toEqual(["lacteo"]);
    expect(excludedGroups("Libre", [{ group: "fruta", allowed: false }])).toEqual(["fruta"]);
    expect(excludedGroups("Libre", [{ group: "cosa-rara", allowed: false }])).toEqual([]);
  });
  it("sin exclusiones", () => {
    expect(excludedGroups("Lácteo + fruta", [{ group: "lacteo" }])).toEqual([]);
    expect(excludedGroups("sin sal", [])).toEqual([]);
  });
});

describe("recipeGroups / mismatchedGroups", () => {
  const pasta = [
    { families: ["cereal_gluten"], optional: false },
    { families: ["solanacea"], optional: false },
  ];
  it("agrupa las familias y ignora opcionales y desconocidas", () => {
    expect([...recipeGroups(pasta)].sort()).toEqual(["carbohidrato", "verdura"]);
    expect(
      recipeGroups([
        { families: ["cereal"], optional: true },
        { families: ["raro"], optional: false },
      ]).size,
    ).toBe(0);
  });
  it("pasta a la noche con 'sin harinas' no encaja; ensalada sí", () => {
    const rule = { formula: "Proteína + verduras, sin harinas", components: [] };
    expect(mismatchedGroups(rule, pasta)).toEqual(["carbohidrato"]);
    expect(mismatchedGroups(rule, [{ families: ["hoja_verde", "ave"], optional: false }])).toEqual(
      [],
    );
  });
});

describe("rulesFor", () => {
  const rules: MealRule[] = [
    { userId: "a", displayName: "Ana", slot: "dinner", days: null, formula: "x", components: [] },
    { userId: "a", displayName: "Ana", slot: "lunch", days: [1], formula: "y", components: [] },
    { userId: "b", displayName: "Beto", slot: "dinner", days: [], formula: "z", components: [] },
  ];
  it("filtra por momento, día y persona", () => {
    expect(rulesFor(rules, "dinner", "2026-11-16", dayOfWeek)).toHaveLength(2);
    expect(rulesFor(rules, "dinner", "2026-11-16", dayOfWeek, "a")).toHaveLength(1);
    expect(rulesFor(rules, "lunch", "2026-11-16", dayOfWeek)).toHaveLength(1); // lunes = 1
    expect(rulesFor(rules, "lunch", "2026-11-17", dayOfWeek)).toHaveLength(0);
  });
});
