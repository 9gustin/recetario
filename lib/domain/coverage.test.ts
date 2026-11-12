import { describe, expect, it } from "vitest";
import { computeCoverage, coverageLabel, splitIngredients } from "./coverage";

const ing = (name: string, optional = false, aliases: string[] = []) => ({
  name,
  optional,
  aliases,
});

describe("computeCoverage", () => {
  it("receta cubierta por completo", () => {
    const c = computeCoverage(
      ["pollo", "zapallitos", "huevos"],
      [ing("pollo"), ing("zapallito"), ing("huevo")],
    );
    expect(c.score).toBe(1);
    expect(c.missing).toEqual([]);
    expect(coverageLabel(c)).toBe("Tenés todo");
  });

  it("ignora básicos de alacena", () => {
    const c = computeCoverage([], [ing("sal"), ing("aceite de oliva"), ing("pimienta")]);
    expect(c).toMatchObject({ have: [], missing: [], score: 1 });
  });

  it("separa faltantes obligatorios y opcionales, y calcula el puntaje", () => {
    const c = computeCoverage(
      ["pollo", "limón"],
      [ing("pollo"), ing("limón"), ing("arroz"), ing("jengibre", true), ing("morrón")],
    );
    expect(c.have).toEqual(["pollo", "limón"]);
    expect(c.missing).toEqual(["arroz", "morrón"]);
    expect(c.missingOptional).toEqual(["jengibre"]);
    expect(c.score).toBeCloseTo(0.5);
    expect(coverageLabel(c)).toBe("Te falta: arroz, morrón, jengibre (opcional)");
  });

  it("'pollo' cubre 'pechuga de pollo' y viceversa; 'papa' no cubre 'papa dulce' por equivocación de palabras", () => {
    expect(computeCoverage(["pollo"], [ing("pechuga de pollo")]).score).toBe(1);
    expect(computeCoverage(["pechuga de pollo"], [ing("pollo")]).score).toBe(1);
    expect(computeCoverage(["tomate"], [ing("cebolla")]).score).toBe(0);
  });

  it("usa alias y no cuenta opcionales en el puntaje", () => {
    const c = computeCoverage(
      ["calabacín"],
      [ing("zapallito", false, ["calabacin"]), ing("perejil", true)],
    );
    expect(c.score).toBe(1);
    expect(c.missingOptional).toEqual(["perejil"]);
  });

  it("sin ingredientes obligatorios el puntaje es 1; un ingrediente opcional cubierto se lista", () => {
    const c = computeCoverage(["perejil"], [ing("perejil", true)]);
    expect(c.score).toBe(1);
    expect(c.have).toEqual(["perejil"]);
  });

  it("ignora entradas vacías", () => {
    expect(computeCoverage(["", "  "], [ing("arroz")]).score).toBe(0);
    expect(computeCoverage(["arroz"], [ing("")]).score).toBe(1);
  });
});

describe("splitIngredients", () => {
  it("separa por comas y 'y'", () => {
    expect(splitIngredients("pollo, zapallitos y huevos")).toEqual([
      "pollo",
      "zapallitos",
      "huevos",
    ]);
  });
  it("saca muletillas y puntos finales", () => {
    expect(splitIngredients("Tengo pollo; me quedan limones.")).toEqual(
      ["Tengo pollo", "limones"].map((s) => s.replace(/^Tengo /, "")),
    );
  });
  it("descarta vacíos y textos larguísimos", () => {
    expect(splitIngredients(",,  ,")).toEqual([]);
    expect(splitIngredients("x".repeat(80))).toEqual([]);
  });
});
