import { describe, it, expect } from "vitest";
import { matchLocal, normalizeName, type CatalogIngredient } from "./ingredient-match";

const catalog: CatalogIngredient[] = [
  { id: "1", name: "palta", aliases: ["aguacate"] },
  { id: "2", name: "zapallito", aliases: ["calabacín"] },
  { id: "3", name: "morrón", aliases: ["pimiento"] },
  { id: "4", name: "choclo", aliases: ["maíz"] },
  { id: "5", name: "frutilla", aliases: ["fresa"] },
  { id: "6", name: "ananá", aliases: ["piña"] },
  { id: "7", name: "porotos", aliases: ["frijoles"] },
  { id: "8", name: "chaucha", aliases: ["judía verde"] },
  { id: "9", name: "cebolla", aliases: ["cebolla blanca"] },
  { id: "10", name: "tomate", aliases: [] },
  { id: "11", name: "harina", aliases: [] },
];

describe("normalizeName", () => {
  it("quita acentos y pasa a minúsculas", () => {
    expect(normalizeName("ANANÁ")).toBe("anana");
    expect(normalizeName("Zanahorías")).toBe("zanahorias");
  });

  it("quita palabras de relleno", () => {
    expect(normalizeName("de cebolla")).toBe("cebolla");
    expect(normalizeName("cebolla picada")).toBe("cebolla");
    expect(normalizeName("el tomate fresco")).toBe("tomate");
  });
});

describe("matchLocal", () => {
  it("encuentra por nombre exacto", () => {
    expect(matchLocal("cebolla", catalog)?.id).toBe("9");
  });

  it("encuentra por alias regional", () => {
    expect(matchLocal("aguacate", catalog)?.id).toBe("1");
    expect(matchLocal("calabacín", catalog)?.id).toBe("2");
    expect(matchLocal("pimiento", catalog)?.id).toBe("3");
    expect(matchLocal("maíz", catalog)?.id).toBe("4");
    expect(matchLocal("fresa", catalog)?.id).toBe("5");
    expect(matchLocal("piña", catalog)?.id).toBe("6");
    expect(matchLocal("frijoles", catalog)?.id).toBe("7");
  });

  it("encuentra plurales", () => {
    expect(matchLocal("cebollas", catalog)?.id).toBe("9");
    expect(matchLocal("tomates", catalog)?.id).toBe("10");
  });

  it("normaliza acentos y relleno", () => {
    expect(matchLocal("zanahoría", catalog)).toBeNull();
    expect(matchLocal("harina", catalog)?.id).toBe("11");
  });

  it("devuelve null si no encuentra", () => {
    expect(matchLocal("quinoa", catalog)).toBeNull();
    expect(matchLocal("", catalog)).toBeNull();
  });
});
