import { describe, expect, it } from "vitest";
import {
  buildContextText,
  formatCookingContext,
  formatRecipeForPrompt,
  type PromptRecipe,
} from "./format";

const pollo: PromptRecipe = {
  id: "r1",
  title: "Pollo al limón",
  servings: 4,
  total_minutes: 35,
  tags: ["rápida"],
  ingredients: [{ raw_text: "2 pechugas" }, { raw_text: "1 limón" }],
  steps: [
    { instruction: "Cortá el pollo.", duration_seconds: null },
    { instruction: "Dorá el pollo.", duration_seconds: 600 },
    { instruction: "Sumá el limón.", duration_seconds: null },
  ],
};

describe("formatRecipeForPrompt", () => {
  it("incluye id, ingredientes y pasos numerados con tiempos", () => {
    const text = formatRecipeForPrompt(pollo);
    expect(text).toContain('Receta "Pollo al limón" (id: r1)');
    expect(text).toContain("- 2 pechugas");
    expect(text).toContain("2. Dorá el pollo. (10 min)");
  });
});

describe("formatCookingContext", () => {
  it("dice en qué paso está, con su texto, las porciones y los timers", () => {
    const text = formatCookingContext({
      recipe: pollo,
      step: 2,
      servings: 6,
      timers: [{ label: "Paso 2", remaining_seconds: 750 }],
    });
    expect(text).toContain("paso 2 de 3");
    expect(text).toContain("Dorá el pollo.");
    expect(text).toContain("6 porciones");
    expect(text).toContain("Paso 2 (12:30 restantes)");
  });

  it("contempla la mise en place, el final y la ausencia de timers", () => {
    expect(formatCookingContext({ recipe: pollo, step: 0, servings: 4, timers: [] })).toContain(
      "mise en place",
    );
    expect(formatCookingContext({ recipe: pollo, step: 4, servings: 4, timers: [] })).toContain(
      "terminó",
    );
    expect(formatCookingContext({ recipe: pollo, step: 1, servings: 4, timers: [] })).toContain(
      "No hay timers",
    );
  });
});

describe("buildContextText", () => {
  it("no repite la receta de la sesión si también fue citada", () => {
    const text = buildContextText({
      mentioned: [pollo, { ...pollo, id: "r2", title: "Ensalada" }],
      cooking: { recipe: pollo, step: 1, servings: 4, timers: [] },
    });
    expect(text.match(/Receta "Pollo al limón"/g)).toHaveLength(1);
    expect(text).toContain('Receta "Ensalada"');
  });
  it("sin sesión de cocina, solo las recetas citadas", () => {
    const text = buildContextText({ mentioned: [pollo] });
    expect(text).not.toContain("MODO COCINAR");
    expect(text).toContain("Recetas citadas");
  });
});
