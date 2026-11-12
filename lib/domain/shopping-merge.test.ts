import { describe, expect, it } from "vitest";
import { mergeShoppingItems, type ExistingItem } from "./shopping-merge";
import type { ShoppingItem } from "./shopping-list";

const fresh = (name: string, id: string | null = name): ShoppingItem => ({
  ingredientId: id,
  displayName: name,
  quantity: 1,
  unit: "unidad",
  aisle: "otros",
  neededBy: "2026-11-16",
  sourceEntryIds: [],
  pantryStaple: false,
  shopDate: null,
});
const old = (id: string, name: string, extra: Partial<ExistingItem> = {}): ExistingItem => ({
  id,
  ingredientId: name,
  displayName: name,
  state: "pending",
  isManual: false,
  noLongerNeeded: false,
  ...extra,
});

describe("mergeShoppingItems", () => {
  it("conserva lo tachado: actualiza cantidades sin tocar el estado", () => {
    const plan = mergeShoppingItems([old("1", "pollo", { state: "bought" })], [fresh("pollo")]);
    expect(plan.updates.map((u) => u.id)).toEqual(["1"]);
    expect(plan.inserts).toEqual([]);
    expect(plan.deletes).toEqual([]);
    expect(plan.markNoLongerNeeded).toEqual([]);
  });

  it("agrega lo nuevo", () => {
    const plan = mergeShoppingItems([old("1", "pollo")], [fresh("pollo"), fresh("arroz")]);
    expect(plan.inserts.map((i) => i.displayName)).toEqual(["arroz"]);
  });

  it("quita lo pendiente que ya no hace falta y marca lo ya comprado", () => {
    const plan = mergeShoppingItems(
      [
        old("1", "pollo"),
        old("2", "arroz", { state: "bought" }),
        old("3", "papa", { state: "have_it" }),
        old("4", "sal", { state: "bought", noLongerNeeded: true }),
      ],
      [],
    );
    expect(plan.deletes).toEqual(["1"]);
    expect(plan.markNoLongerNeeded).toEqual(["2", "3"]);
  });

  it("no toca los ítems manuales", () => {
    const plan = mergeShoppingItems([old("1", "detergente", { isManual: true })], [fresh("pollo")]);
    expect(plan.deletes).toEqual([]);
    expect(plan.markNoLongerNeeded).toEqual([]);
    expect(plan.inserts).toHaveLength(1);
  });

  it("empareja por nombre normalizado cuando no hay ingredient_id", () => {
    const plan = mergeShoppingItems(
      [{ ...old("1", "Papas"), ingredientId: null }],
      [fresh("papa", null)],
    );
    expect(plan.updates).toHaveLength(1);
  });

  it("dos ítems frescos con la misma clave: el segundo se inserta", () => {
    const plan = mergeShoppingItems([old("1", "leche")], [fresh("leche"), fresh("leche")]);
    expect(plan.updates).toHaveLength(1);
    expect(plan.inserts).toHaveLength(1);
  });
});
