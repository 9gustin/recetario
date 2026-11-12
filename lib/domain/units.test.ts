import { describe, it, expect } from "vitest";
import { convert, dimensionOf, normalizeUnit, toBase } from "./units";

describe("normalizeUnit", () => {
  it.each([
    ["g", "g"],
    ["gr", "g"],
    ["gramos", "g"],
    ["kg", "kg"],
    ["kilo", "kg"],
    ["ml", "ml"],
    ["cc", "cc"],
    ["litro", "l"],
    ["cucharada", "cda"],
    ["cucharadas", "cda"],
    ["cuch.", "cda"],
    ["cucharadita", "cdita"],
    ["cdta", "cdita"],
    ["taza", "taza"],
    ["tazas", "taza"],
    ["unidad", "unidad"],
    ["dientes", "diente"],
    ["rodajas", "rodaja"],
  ])("%s → %s", (raw, expected) => {
    expect(normalizeUnit(raw)).toBe(expected);
  });

  it("devuelve null para lo que no reconoce", () => {
    expect(normalizeUnit("cucharón")).toBeNull();
    expect(normalizeUnit("")).toBeNull();
  });
});

describe("convert", () => {
  it.each([
    [1, "kg", "g", 1000],
    [500, "g", "kg", 0.5],
    [1, "l", "ml", 1000],
    [1, "cda", "ml", 15],
    [1, "taza", "ml", 240],
    [3, "cdita", "cda", 1],
    [2, "unidad", "unidad", 2],
  ])("%d %s → %s = %d", (qty, from, to, expected) => {
    expect(convert(qty, from, to)).toBeCloseTo(expected);
  });

  it("devuelve null entre dimensiones distintas", () => {
    expect(convert(100, "g", "ml")).toBeNull();
    expect(convert(2, "unidad", "g")).toBeNull();
  });
});

describe("toBase", () => {
  it("lleva masa a gramos", () => {
    expect(toBase(1, "kg")).toEqual({ qty: 1000, unit: "g" });
    expect(toBase(250, "g")).toEqual({ qty: 250, unit: "g" });
  });

  it("lleva volumen a mililitros", () => {
    expect(toBase(1, "l")).toEqual({ qty: 1000, unit: "ml" });
    expect(toBase(2, "taza")).toEqual({ qty: 480, unit: "ml" });
  });

  it("deja el conteo igual", () => {
    expect(toBase(3, "diente")).toEqual({ qty: 3, unit: "diente" });
  });
});

describe("dimensionOf", () => {
  it("clasifica por dimensión", () => {
    expect(dimensionOf("g")).toBe("mass");
    expect(dimensionOf("ml")).toBe("volume");
    expect(dimensionOf("unidad")).toBe("count");
    expect(dimensionOf("nope")).toBeNull();
  });
});
