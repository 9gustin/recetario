import { describe, it, expect } from "vitest";
import { roundQuantity, scaleQuantity } from "./scale";

describe("scaleQuantity", () => {
  it.each([
    [200, 2, 4, 400],
    [1, 2, 3, 1.5],
    [100, 4, 2, 50],
    [1, 1, 1, 1],
    [3, 2, 6, 9],
  ])("%d de %d a %d porciones → %d", (qty, from, to, expected) => {
    expect(scaleQuantity(qty, from, to)).toBeCloseTo(expected);
  });
});

describe("roundQuantity", () => {
  it("gramos a 10 cuando es grande", () => {
    expect(roundQuantity(333.33, "g")).toBe(330);
    expect(roundQuantity(667, "g")).toBe(670);
  });

  it("gramos a 5 cuando es mediano", () => {
    expect(roundQuantity(62.5, "g")).toBe(65);
    expect(roundQuantity(47, "g")).toBe(45);
  });

  it("unidades enteras o medias", () => {
    expect(roundQuantity(2.5, "unidad")).toBe(2.5);
    expect(roundQuantity(3.75, "unidad")).toBe(4);
  });

  it("cucharadas a 1/2", () => {
    expect(roundQuantity(1.5, "cda")).toBe(1.5);
    expect(roundQuantity(2.25, "cda")).toBe(2.5);
  });

  it("cero queda cero", () => {
    expect(roundQuantity(0, "g")).toBe(0);
  });
});
