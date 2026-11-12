import { describe, expect, it } from "vitest";
import {
  estimatedMinutes,
  formatClock,
  ingredientsForStep,
  instructionFontSize,
  scaledIngredientLabel,
  type CookingIngredient,
} from "./cooking-display";

const ing = (
  id: string,
  raw_text: string,
  extra: Partial<CookingIngredient> = {},
): CookingIngredient => ({
  id,
  ingredient_id: null,
  raw_text,
  quantity: null,
  unit: null,
  preparation: null,
  optional: false,
  ...extra,
});

describe("scaledIngredientLabel", () => {
  it("escala cantidades con unidad", () => {
    expect(
      scaledIngredientLabel(ing("1", "200 g de harina", { quantity: 200, unit: "g" }), 2, 4),
    ).toBe("400 g de harina");
  });
  it("sin unidad no agrega 'de'", () => {
    expect(scaledIngredientLabel(ing("1", "2 pechugas", { quantity: 2, unit: null }), 2, 4)).toBe(
      "4 pechugas",
    );
  });
  it("sin cantidad devuelve el texto original", () => {
    expect(scaledIngredientLabel(ing("1", "sal a gusto"), 2, 4)).toBe("sal a gusto");
  });
});

describe("ingredientsForStep", () => {
  const list = [
    ing("a", "2 pechugas de pollo", { ingredient_id: "cat-pollo" }),
    ing("b", "1 limón"),
    ing("c", "sal a gusto"),
  ];
  it("usa los ids del paso (de la receta o del catálogo)", () => {
    const step = {
      instruction: "Cociná.",
      duration_seconds: null,
      ingredient_ids: ["cat-pollo", "b"],
    };
    expect(ingredientsForStep(step, list).map((i) => i.id)).toEqual(["a", "b"]);
  });
  it("sin ids, busca los ingredientes nombrados en el texto", () => {
    const step = {
      instruction: "Dorá el Pollo y exprimí el limón.",
      duration_seconds: null,
      ingredient_ids: [],
    };
    expect(ingredientsForStep(step, list).map((i) => i.id)).toEqual(["a", "b"]);
  });
  it("no inventa ingredientes que no aparecen", () => {
    const step = { instruction: "Serví caliente.", duration_seconds: null, ingredient_ids: null };
    expect(ingredientsForStep(step, list)).toEqual([]);
  });
});

describe("formatClock / instructionFontSize / estimatedMinutes", () => {
  it("formatea mm:ss", () => {
    expect(formatClock(300)).toBe("5:00");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(-3)).toBe("0:00");
  });
  it("achica el texto largo pero nunca baja de 22", () => {
    expect(instructionFontSize("corto")).toBe(33);
    expect(instructionFontSize("x".repeat(120))).toBe(28);
    expect(instructionFontSize("x".repeat(400))).toBeGreaterThanOrEqual(22);
  });
  it("estima el tiempo total", () => {
    expect(estimatedMinutes({ total_minutes: 35 }, [])).toBe(35);
    expect(
      estimatedMinutes({ total_minutes: null }, [
        { duration_seconds: 600 },
        { duration_seconds: 90 },
      ]),
    ).toBe(12);
    expect(estimatedMinutes({ total_minutes: null }, [{ duration_seconds: null }])).toBeNull();
  });
});
