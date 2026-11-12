import { describe, it, expect } from "vitest";
import { formatQuantity } from "./format";

describe("formatQuantity", () => {
  it.each([
    [1.5, "taza", "1 ½ tazas"],
    [1, "taza", "1 taza"],
    [0.5, "taza", "½ taza"],
    [2, "cda", "2 cdas"],
    [400, "g", "400 g"],
    [1.5, "cda", "1 ½ cdas"],
    [3, "unidad", "3 unidades"],
    [1, "unidad", "1 unidad"],
    [0.25, "taza", "¼ taza"],
    [0.75, "taza", "¾ taza"],
  ])("%d %s → %s", (qty, unit, expected) => {
    expect(formatQuantity(qty, unit)).toBe(expected);
  });

  it("sin unidad devuelve solo el número", () => {
    expect(formatQuantity(2, null)).toBe("2");
  });
});
