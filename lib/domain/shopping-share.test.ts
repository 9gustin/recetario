import { describe, expect, it } from "vitest";
import { aisleLabel, shareAsText, type ShareItem } from "./shopping-share";

const item = (over: Partial<ShareItem>): ShareItem => ({
  display_name: "Pollo",
  quantity: 800,
  unit: "g",
  purchase_hint: null,
  aisle: "carniceria",
  state: "pending",
  no_longer_needed: false,
  ...over,
});

describe("shareAsText", () => {
  it("agrupa por sección y deja solo lo pendiente", () => {
    const text = shareAsText("Compra del lunes", [
      item({}),
      item({ display_name: "Papa", quantity: 2, unit: "unidad", aisle: "verduleria" }),
      item({ display_name: "Arroz", state: "bought", aisle: "almacen" }),
      item({ display_name: "Sal", no_longer_needed: true }),
      item({
        display_name: "Leche",
        quantity: null,
        unit: null,
        aisle: "lacteos",
        purchase_hint: "2 sachets",
      }),
    ]);
    expect(text).toBe(
      "🛒 Compra del lunes\n\n*Carnicería*\n- Pollo (800 g)\n\n*Verdulería*\n- Papa (2 unidades)\n\n*Lácteos*\n- Leche (2 sachets)",
    );
  });
  it("ítem sin cantidad y sección desconocida", () => {
    expect(shareAsText("L", [item({ quantity: null, unit: null, aisle: "rara" })])).toBe(
      "🛒 L\n\n*Rara*\n- Pollo",
    );
    expect(aisleLabel("verduleria")).toBe("Verdulería");
  });
});
