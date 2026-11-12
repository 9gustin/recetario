export type MealSlot = "breakfast" | "lunch" | "merienda" | "dinner" | "snack";

export const MEAL_SLOTS: { key: MealSlot; label: string; plural?: string; order: number }[] = [
  { key: "breakfast", label: "Desayuno", order: 0 },
  { key: "lunch", label: "Almuerzo", order: 1 },
  { key: "merienda", label: "Merienda", order: 2 },
  { key: "dinner", label: "Cena", order: 3 },
  { key: "snack", label: "Snacks", order: 4 },
];

export const DEFAULT_MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "merienda", "dinner", "snack"];

export const slotLabel = (slot: string) => MEAL_SLOTS.find((s) => s.key === slot)?.label ?? slot;
export const slotOrder = (slot: string) => MEAL_SLOTS.find((s) => s.key === slot)?.order ?? 99;

/** Momentos del grupo en orden de día (ignora los que no existen). */
export function sortSlots(slots: string[]): MealSlot[] {
  return MEAL_SLOTS.filter((s) => slots.includes(s.key)).map((s) => s.key);
}
