import { describe, it, expect } from "vitest";
import { parseIngredientLine } from "./ingredient-line";

describe("parseIngredientLine — recetas argentinas reales", () => {
  const cases: [string, { quantity: number | null; unit: string | null; name: string }][] = [
    ["1 kg de asado de tira", { quantity: 1, unit: "kg", name: "asado de tira" }],
    ["500 g de harina 0000", { quantity: 500, unit: "g", name: "harina 0000" }],
    ["250 gramos de manteca", { quantity: 250, unit: "g", name: "manteca" }],
    ["3 cebollas", { quantity: 3, unit: "unidad", name: "cebollas" }],
    ["2 dientes de ajo", { quantity: 2, unit: "diente", name: "ajo" }],
    ["1 morrón rojo", { quantity: 1, unit: "unidad", name: "morrón rojo" }],
    ["2 zapallitos", { quantity: 2, unit: "unidad", name: "zapallitos" }],
    ["4 papas medianas", { quantity: 4, unit: "unidad", name: "papas medianas" }],
    ["2 pechugas de pollo", { quantity: 2, unit: "unidad", name: "pechugas de pollo" }],
    ["1/2 taza de aceite", { quantity: 0.5, unit: "taza", name: "aceite" }],
    ["1 y 1/2 tazas de harina leudante", { quantity: 1.5, unit: "taza", name: "harina leudante" }],
    ["2 cdas de perejil picado", { quantity: 2, unit: "cda", name: "perejil picado" }],
    ["1 cucharadita de pimentón", { quantity: 1, unit: "cdita", name: "pimentón" }],
    ["200 cc de crema de leche", { quantity: 200, unit: "cc", name: "crema de leche" }],
    ["1 litro de caldo de verduras", { quantity: 1, unit: "l", name: "caldo de verduras" }],
    ["100 g de queso rallado", { quantity: 100, unit: "g", name: "queso rallado" }],
    ["2 latas de tomate perita", { quantity: 2, unit: "lata", name: "tomate perita" }],
    ["1 atado de rúcula", { quantity: 1, unit: "atado", name: "rúcula" }],
    ["4 fetas de jamón cocido", { quantity: 4, unit: "feta", name: "jamón cocido" }],
    ["6 rodajas de tomate", { quantity: 6, unit: "rodaja", name: "tomate" }],
    [
      "1 paquete de tapas de empanadas",
      { quantity: 1, unit: "paquete", name: "tapas de empanadas" },
    ],
    ["2 huevos", { quantity: 2, unit: "unidad", name: "huevos" }],
    ["200 g de pechuga de pollo, en cubos", { quantity: 200, unit: "g", name: "pechuga de pollo" }],
    ["1 cebolla, picada", { quantity: 1, unit: "unidad", name: "cebolla" }],
    ["½ kilo de carne picada", { quantity: 0.5, unit: "kg", name: "carne picada" }],
    ["¾ taza de azúcar", { quantity: 0.75, unit: "taza", name: "azúcar" }],
    ["1,5 kg de bondiola", { quantity: 1.5, unit: "kg", name: "bondiola" }],
    ["2-3 dientes de ajo", { quantity: 2.5, unit: "diente", name: "ajo" }],
    ["3 cdas de aceite de oliva", { quantity: 3, unit: "cda", name: "aceite de oliva" }],
    ["1 cda de vinagre", { quantity: 1, unit: "cda", name: "vinagre" }],
    ["250 g de ricota", { quantity: 250, unit: "g", name: "ricota" }],
    ["1 taza de polenta", { quantity: 1, unit: "taza", name: "polenta" }],
    ["2 choclos", { quantity: 2, unit: "unidad", name: "choclos" }],
    ["1 palta", { quantity: 1, unit: "unidad", name: "palta" }],
    [
      "1 frasco de salsa de tomate",
      { quantity: 1, unit: "unidad", name: "frasco de salsa de tomate" },
    ],
    ["200 g de espinaca", { quantity: 200, unit: "g", name: "espinaca" }],
    ["1 atado de verdeo", { quantity: 1, unit: "atado", name: "verdeo" }],
    ["4 huevos duros", { quantity: 4, unit: "unidad", name: "huevos duros" }],
    ["100 g de manteca, derretida", { quantity: 100, unit: "g", name: "manteca" }],
    ["1 cdita de orégano", { quantity: 1, unit: "cdita", name: "orégano" }],
    ["2 cucharadas de queso crema", { quantity: 2, unit: "cda", name: "queso crema" }],
    ["1 sobre de levadura", { quantity: 1, unit: "unidad", name: "sobre de levadura" }],
    ["3 tazas de harina", { quantity: 3, unit: "taza", name: "harina" }],
    ["500 g de ñoquis", { quantity: 500, unit: "g", name: "ñoquis" }],
  ];

  it.each(cases)("%s", (input, expected) => {
    const r = parseIngredientLine(input);
    expect(r.quantity).toBeCloseTo(expected.quantity ?? 0);
    expect(r.unit).toBe(expected.unit);
    expect(r.name).toBe(expected.name);
  });
});

describe("parseIngredientLine — casos especiales", () => {
  it("sal a gusto", () => {
    const r = parseIngredientLine("sal a gusto");
    expect(r.quantity).toBeNull();
    expect(r.name).toBe("sal");
    expect(r.note).toBe("a gusto");
  });

  it("pimienta c/n", () => {
    const r = parseIngredientLine("pimienta c/n");
    expect(r.quantity).toBeNull();
    expect(r.name).toBe("pimienta");
    expect(r.note).toBe("a gusto");
  });

  it("opcional", () => {
    const r = parseIngredientLine("1 cebolla (opcional)");
    expect(r.optional).toBe(true);
    expect(r.name).toBe("cebolla");
  });

  it("preparación tras coma", () => {
    const r = parseIngredientLine("200 g de pollo, en cubos");
    expect(r.preparation).toBe("en cubos");
  });

  it("rango deja nota con el original", () => {
    const r = parseIngredientLine("2-3 zapallitos");
    expect(r.quantity).toBe(2.5);
    expect(r.note).toBe("2-3");
  });

  it("fracción mixta con 'y'", () => {
    const r = parseIngredientLine("1 y 1/2 tazas de harina");
    expect(r.quantity).toBeCloseTo(1.5);
    expect(r.unit).toBe("taza");
  });
});
