/** Armado de la lista de compras a partir de un plan. Lógica pura, sin DB ni IA. */
import { PANTRY_BASICS } from "./coverage";
import { formatQuantity } from "./format";
import { nameKey } from "./ingredient-match";
import { isPerishableLate } from "./perishability";
import { scaleQuantity } from "./scale";
import { dimensionOf, normalizeUnit, toBase } from "./units";
import { daysBetween } from "./week";

export type ShopEntry = {
  id: string;
  date: string;
  recipeId: string | null;
  servings: number | null;
  /** Veces que se cocina la receta (por defecto 1). */
  quantity?: number;
  leftoversOfEntryId: string | null;
  /** Día en que se cocina, si es distinto del que se come. */
  cookDate?: string | null;
};

export type ShopRecipeIngredient = {
  ingredientId: string | null;
  name: string;
  quantity: number | null;
  unit: string | null;
  optional?: boolean;
};

export type ShopRecipe = { id: string; servings: number; ingredients: ShopRecipeIngredient[] };

export type CatalogInfo = {
  id: string;
  aisle?: string | null;
  /** Peso de una unidad en gramos (para sumar "3 papas" con "500 g de papa"). */
  unitWeightG?: number | null;
  /** Días máximos de vida en heladera (null = no perecedero / sin dato). */
  maxFridgeDays?: number | null;
};

export type ShoppingItem = {
  ingredientId: string | null;
  displayName: string;
  quantity: number | null;
  unit: string | null;
  aisle: string;
  neededBy: string;
  sourceEntryIds: string[];
  pantryStaple: boolean;
  /** Fecha de la compra a la que corresponde (según `shopDates`). */
  shopDate: string | null;
};

export const AISLE_ORDER = [
  "verduleria",
  "carniceria",
  "pescaderia",
  "fiambreria",
  "lacteos",
  "panaderia",
  "almacen",
  "congelados",
  "bebidas",
  "limpieza",
  "otros",
];

const aisleRank = (aisle: string) => {
  const i = AISLE_ORDER.indexOf(aisle);
  return i === -1 ? AISLE_ORDER.length : i;
};

const PANTRY_KEYS = new Set(PANTRY_BASICS.map(nameKey));

type Use = { date: string; entryId: string; qty: number | null; unit: string | null };
type Group = { ingredientId: string | null; name: string; uses: Use[] };

export function buildShoppingList(input: {
  entries: ShopEntry[];
  recipes: ShopRecipe[];
  catalog: CatalogInfo[];
  shopDates?: string[];
}): ShoppingItem[] {
  const recipes = new Map(input.recipes.map((r) => [r.id, r]));
  const catalog = new Map(input.catalog.map((c) => [c.id, c]));
  const groups = new Map<string, Group>();

  for (const entry of input.entries) {
    // Texto libre y sobras no compran nada: las sobras ya están en la comida original.
    if (!entry.recipeId || entry.leftoversOfEntryId) continue;
    const recipe = recipes.get(entry.recipeId);
    if (!recipe) continue;
    const target = (entry.servings ?? recipe.servings) * (entry.quantity ?? 1);
    const date = entry.cookDate ?? entry.date;
    for (const ing of recipe.ingredients) {
      if (!ing.name.trim()) continue;
      const key = ing.ingredientId ?? `n:${nameKey(ing.name)}`;
      const group = groups.get(key) ?? { ingredientId: ing.ingredientId, name: ing.name, uses: [] };
      const unit = ing.unit ? normalizeUnit(ing.unit) : null;
      group.uses.push({
        date,
        entryId: entry.id,
        qty: ing.quantity === null ? null : scaleQuantity(ing.quantity, recipe.servings, target),
        unit: ing.quantity === null ? null : (unit ?? "unidad"),
      });
      groups.set(key, group);
    }
  }

  const items: ShoppingItem[] = [];
  for (const group of groups.values()) {
    const info = group.ingredientId ? catalog.get(group.ingredientId) : undefined;
    const dates = group.uses.map((u) => u.date).sort();
    const neededBy = dates[0]!;
    const lastUse = dates[dates.length - 1]!;
    const sourceEntryIds = [...new Set(group.uses.map((u) => u.entryId))];
    const base = {
      ingredientId: group.ingredientId,
      displayName: group.name,
      aisle: info?.aisle || "otros",
      neededBy,
      sourceEntryIds,
      pantryStaple: PANTRY_KEYS.has(nameKey(group.name)),
    };

    // Suma por dimensión: masa (g), volumen (ml) y conteo (por unidad).
    let mass = 0;
    let volume = 0;
    const counts = new Map<string, number>();
    for (const u of group.uses) {
      if (u.qty === null || u.unit === null) continue;
      const b = toBase(u.qty, u.unit);
      if (!b) continue;
      if (b.unit === "g") mass += b.qty;
      else if (b.unit === "ml") volume += b.qty;
      else counts.set(b.unit, (counts.get(b.unit) ?? 0) + b.qty);
    }
    // Unidades sueltas ("3 papas") se pasan a gramos si hay peso unitario y ya hay gramos.
    const loose = counts.get("unidad");
    if (loose !== undefined && info?.unitWeightG && mass > 0) {
      mass += loose * info.unitWeightG;
      counts.delete("unidad");
    }

    const quantities: { quantity: number; unit: string }[] = [];
    if (mass > 0) quantities.push({ quantity: mass, unit: "g" });
    if (volume > 0) quantities.push({ quantity: volume, unit: "ml" });
    for (const [unit, quantity] of counts) quantities.push({ quantity, unit });
    if (quantities.length === 0) quantities.push({ quantity: NaN, unit: "" });

    const perishableLate =
      input.shopDates && input.shopDates.length > 1
        ? isPerishableLate(info?.maxFridgeDays, daysBetween(input.shopDates[0]!, lastUse))
        : false;
    const shopDates = input.shopDates ?? [];
    const shopDate =
      shopDates.length === 0
        ? null
        : shopDates.length > 1 && perishableLate && neededBy >= shopDates[1]!
          ? shopDates[1]!
          : shopDates[0]!;

    for (const q of quantities) {
      items.push({
        ...base,
        quantity: Number.isNaN(q.quantity) ? null : q.quantity,
        unit: q.unit === "" ? null : q.unit,
        shopDate,
      });
    }
  }

  return items.sort(
    (a, b) =>
      aisleRank(a.aisle) - aisleRank(b.aisle) || a.displayName.localeCompare(b.displayName, "es"),
  );
}

/** Cantidad para comprar, siempre redondeada hacia arriba: "800 g", "1 ½ kg", "3 unidades". */
export function formatPurchaseQuantity(quantity: number | null, unit: string | null): string {
  if (quantity === null) return "";
  const dim = unit ? dimensionOf(unit) : null;
  if (unit === "g" || unit === "ml") {
    const step = quantity < 100 ? 5 : 10;
    const rounded = Math.ceil(quantity / step) * step;
    if (rounded >= 1000) {
      const big = Math.ceil((rounded / 1000) * 4) / 4;
      return `${formatBig(big)} ${unit === "g" ? "kg" : "l"}`;
    }
    return `${rounded} ${unit}`;
  }
  if (dim === "count" || unit === null) {
    const n = Math.ceil(quantity);
    return formatQuantity(n, unit ?? "unidad");
  }
  return formatQuantity(quantity, unit);
}

const FRACTIONS: Record<number, string> = { 0.25: "¼", 0.5: "½", 0.75: "¾" };

/** 1,5 → "1 ½"; solo cuartos (la compra se redondea hacia arriba a cuartos). */
function formatBig(n: number): string {
  const whole = Math.floor(n);
  const frac = FRACTIONS[n - whole];
  if (!frac) return String(whole);
  return whole === 0 ? frac : `${whole} ${frac}`;
}
