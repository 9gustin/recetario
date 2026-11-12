/** Regenerar una lista conservando lo que la gente ya tachó, anotó o agregó a mano. Lógica pura. */
import { nameKey } from "./ingredient-match";
import type { ShoppingItem } from "./shopping-list";

export type ExistingItem = {
  id: string;
  ingredientId: string | null;
  displayName: string;
  state: "pending" | "bought" | "have_it";
  isManual: boolean;
  noLongerNeeded: boolean;
};

export type MergePlan = {
  inserts: ShoppingItem[];
  /** Ítems que siguen haciendo falta: se actualiza cantidad y fechas, no el estado ni la nota. */
  updates: { id: string; item: ShoppingItem; noLongerNeeded: false }[];
  /** Pendientes que ya no hacen falta. */
  deletes: string[];
  /** Ya comprados / "ya lo tengo" que ya no hacen falta: se marcan, no se borran. */
  markNoLongerNeeded: string[];
};

export const itemKey = (i: { ingredientId: string | null; displayName: string }) =>
  i.ingredientId ?? `n:${nameKey(i.displayName)}`;

export function mergeShoppingItems(existing: ExistingItem[], fresh: ShoppingItem[]): MergePlan {
  const byKey = new Map(existing.filter((e) => !e.isManual).map((e) => [itemKey(e), e]));
  const used = new Set<string>();
  const plan: MergePlan = { inserts: [], updates: [], deletes: [], markNoLongerNeeded: [] };

  for (const item of fresh) {
    const key = itemKey(item);
    const match = byKey.get(key);
    if (match && !used.has(key)) {
      used.add(key);
      plan.updates.push({ id: match.id, item, noLongerNeeded: false });
    } else {
      plan.inserts.push(item);
    }
  }
  for (const e of existing) {
    if (e.isManual || used.has(itemKey(e))) continue;
    if (e.state === "pending") plan.deletes.push(e.id);
    else if (!e.noLongerNeeded) plan.markNoLongerNeeded.push(e.id);
  }
  return plan;
}
