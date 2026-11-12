import { describe, expect, it } from "vitest";
import {
  buildShoppingList,
  formatPurchaseQuantity,
  type CatalogInfo,
  type ShopEntry,
  type ShopRecipe,
} from "./shopping-list";

const entry = (
  id: string,
  date: string,
  recipeId: string | null,
  extra: Partial<ShopEntry> = {},
): ShopEntry => ({
  id,
  date,
  recipeId,
  servings: null,
  leftoversOfEntryId: null,
  ...extra,
});
const recipe = (
  id: string,
  servings: number,
  ingredients: ShopRecipe["ingredients"],
): ShopRecipe => ({
  id,
  servings,
  ingredients,
});
const ing = (
  name: string,
  quantity: number | null,
  unit: string | null,
  ingredientId: string | null = name,
) => ({
  ingredientId,
  name,
  quantity,
  unit,
});

const catalog: CatalogInfo[] = [
  { id: "papa", aisle: "verduleria", unitWeightG: 200 },
  { id: "pollo", aisle: "carniceria" },
  { id: "rucula", aisle: "verduleria", maxFridgeDays: 3 },
  { id: "leche", aisle: "lacteos" },
];

describe("buildShoppingList", () => {
  it("suma g y kg del mismo ingrediente", () => {
    const items = buildShoppingList({
      entries: [entry("e1", "2026-11-16", "r1"), entry("e2", "2026-11-17", "r2")],
      recipes: [
        recipe("r1", 2, [ing("pollo", 500, "g")]),
        recipe("r2", 2, [ing("pollo", 1, "kg")]),
      ],
      catalog,
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      quantity: 1500,
      unit: "g",
      neededBy: "2026-11-16",
      aisle: "carniceria",
    });
    expect(items[0]!.sourceEntryIds).toEqual(["e1", "e2"]);
  });

  it("suma unidades con gramos usando el peso unitario", () => {
    const items = buildShoppingList({
      entries: [entry("e1", "2026-11-16", "r1"), entry("e2", "2026-11-17", "r2")],
      recipes: [recipe("r1", 2, [ing("papa", 500, "g")]), recipe("r2", 2, [ing("papa", 3, null)])],
      catalog,
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ quantity: 1100, unit: "g" });
  });

  it("unidades sin peso unitario o sin gramos quedan como unidades", () => {
    const items = buildShoppingList({
      entries: [entry("e1", "2026-11-16", "r1")],
      recipes: [recipe("r1", 2, [ing("papa", 3, "unidades"), ing("huevo", 2, "unidad", null)])],
      catalog,
    });
    expect(items.find((i) => i.displayName === "papa")).toMatchObject({
      quantity: 3,
      unit: "unidad",
    });
    expect(items.find((i) => i.displayName === "huevo")).toMatchObject({
      quantity: 2,
      ingredientId: null,
    });
  });

  it("ignora texto libre, sobras y recetas desconocidas", () => {
    const items = buildShoppingList({
      entries: [
        entry("e1", "2026-11-16", "r1"),
        entry("e2", "2026-11-17", "r1", { leftoversOfEntryId: "e1" }),
        entry("e3", "2026-11-18", null),
        entry("e4", "2026-11-19", "no-existe"),
      ],
      recipes: [recipe("r1", 2, [ing("pollo", 500, "g")])],
      catalog,
    });
    expect(items[0]).toMatchObject({ quantity: 500, sourceEntryIds: ["e1"] });
  });

  it("escala por las porciones de la entrada", () => {
    const items = buildShoppingList({
      entries: [entry("e1", "2026-11-16", "r1", { servings: 6 })],
      recipes: [recipe("r1", 2, [ing("pollo", 400, "g")])],
      catalog,
    });
    expect(items[0]!.quantity).toBe(1200);
  });

  it("ingrediente sin cantidad: un solo ítem sin cantidad; si otros usos tienen cantidad, se ignora el 'a gusto'", () => {
    const sinCantidad = buildShoppingList({
      entries: [entry("e1", "2026-11-16", "r1"), entry("e2", "2026-11-17", "r1")],
      recipes: [recipe("r1", 2, [ing("orégano", null, null, null)])],
      catalog,
    });
    expect(sinCantidad).toHaveLength(1);
    expect(sinCantidad[0]).toMatchObject({ quantity: null, unit: null });
    const mezcla = buildShoppingList({
      entries: [entry("e1", "2026-11-16", "r1"), entry("e2", "2026-11-17", "r2")],
      recipes: [
        recipe("r1", 2, [ing("pollo", null, null)]),
        recipe("r2", 2, [ing("pollo", 300, "g")]),
      ],
      catalog,
    });
    expect(mezcla).toHaveLength(1);
    expect(mezcla[0]!.quantity).toBe(300);
  });

  it("marca básicos de alacena, ignora nombres vacíos y ordena por sección y nombre", () => {
    const items = buildShoppingList({
      entries: [entry("e1", "2026-11-16", "r1")],
      recipes: [
        recipe("r1", 2, [
          ing("sal", null, null, null),
          ing("", 1, "g", null),
          ing("leche", 200, "ml"),
          ing("pollo", 500, "g"),
          ing("papa", 2, "unidad"),
        ]),
      ],
      catalog,
    });
    expect(items.map((i) => i.displayName)).toEqual(["papa", "pollo", "leche", "sal"]);
    expect(items.find((i) => i.displayName === "sal")).toMatchObject({
      pantryStaple: true,
      aisle: "otros",
    });
  });

  it("ordena secciones desconocidas al final y volúmenes se suman", () => {
    const items = buildShoppingList({
      entries: [entry("e1", "2026-11-16", "r1")],
      recipes: [
        recipe("r1", 2, [
          ing("leche", 1, "taza"),
          ing("leche", 1, "l"),
          ing("raro", 1, "unidad", "raro"),
        ]),
      ],
      catalog: [...catalog, { id: "raro", aisle: "seccion-rara" }],
    });
    expect(items[0]).toMatchObject({ displayName: "leche", quantity: 1240, unit: "ml" });
    expect(items[1]!.displayName).toBe("raro");
  });

  it("usa la fecha de cocción como 'necesario para'", () => {
    const items = buildShoppingList({
      entries: [entry("e1", "2026-11-20", "r1", { cookDate: "2026-11-18" })],
      recipes: [recipe("r1", 2, [ing("pollo", 500, "g")])],
      catalog,
    });
    expect(items[0]!.neededBy).toBe("2026-11-18");
  });

  it("divide en dos compras: lo perecedero que se usa tarde va a la segunda", () => {
    const items = buildShoppingList({
      entries: [entry("e1", "2026-11-16", "r1"), entry("e2", "2026-11-20", "r2")],
      recipes: [
        recipe("r1", 2, [ing("pollo", 500, "g")]),
        recipe("r2", 2, [ing("rucula", 1, "atado"), ing("papa", 2, "unidad")]),
      ],
      catalog,
      shopDates: ["2026-11-15", "2026-11-19"],
    });
    expect(items.find((i) => i.displayName === "rucula")!.shopDate).toBe("2026-11-19");
    expect(items.find((i) => i.displayName === "papa")!.shopDate).toBe("2026-11-15");
    expect(items.find((i) => i.displayName === "pollo")!.shopDate).toBe("2026-11-15");
  });

  it("con una sola fecha de compra todo va a esa fecha", () => {
    const items = buildShoppingList({
      entries: [entry("e1", "2026-11-20", "r1")],
      recipes: [recipe("r1", 2, [ing("rucula", 1, "atado")])],
      catalog,
      shopDates: ["2026-11-15"],
    });
    expect(items[0]!.shopDate).toBe("2026-11-15");
  });

  it("perecedero usado tarde pero también temprano queda en la primera compra", () => {
    const items = buildShoppingList({
      entries: [entry("e1", "2026-11-16", "r1"), entry("e2", "2026-11-21", "r1")],
      recipes: [recipe("r1", 2, [ing("rucula", 1, "atado")])],
      catalog,
      shopDates: ["2026-11-15", "2026-11-19"],
    });
    expect(items[0]!.shopDate).toBe("2026-11-15");
  });
});

describe("formatPurchaseQuantity", () => {
  it("redondea hacia arriba", () => {
    expect(formatPurchaseQuantity(null, null)).toBe("");
    expect(formatPurchaseQuantity(792, "g")).toBe("800 g");
    expect(formatPurchaseQuantity(42, "g")).toBe("45 g");
    expect(formatPurchaseQuantity(1500, "g")).toBe("1 ½ kg");
    expect(formatPurchaseQuantity(1200, "ml")).toBe("1 ¼ l");
    expect(formatPurchaseQuantity(2.2, "unidad")).toBe("3 unidades");
    expect(formatPurchaseQuantity(1, "unidad")).toBe("1 unidad");
    expect(formatPurchaseQuantity(1, "atado")).toBe("1 atado");
    expect(formatPurchaseQuantity(2, "cda")).toBe("2 cdas");
    expect(formatPurchaseQuantity(3, null)).toBe("3 unidades");
  });
});
