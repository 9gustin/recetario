import type { SupabaseClient } from "@supabase/supabase-js";
import { mergeShoppingItems, type ExistingItem } from "@/lib/domain/shopping-merge";
import {
  buildShoppingList,
  formatPurchaseQuantity,
  type ShoppingItem,
} from "@/lib/domain/shopping-list";
import { MENU_DATE, addDays, dayLabel, todayString } from "@/lib/domain/week";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

const maxFridge = (shelf: unknown): number | null => {
  const f = (shelf as { fridge?: unknown } | null)?.fridge;
  return Array.isArray(f) && typeof f[1] === "number" ? f[1] : null;
};

/** Genera (o regenera, conservando lo tachado) la lista de compras de un plan. Devuelve las listas tocadas. */
export async function generateShoppingLists(
  supabase: Client,
  planId: string,
): Promise<{ ok: true; listIds: string[] } | { ok: false; error: string }> {
  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id, group_id, week_start")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return { ok: false, error: "No encontramos el plan." };

  const { data: entries } = await supabase
    .from("meal_plan_entries")
    .select("id, date, recipe_id, servings, quantity, leftovers_of_entry_id, cook_date")
    .eq("plan_id", planId);
  const recipeIds = [
    ...new Set((entries ?? []).flatMap((e) => (e.recipe_id ? [e.recipe_id] : []))),
  ];

  const { data: recipeRows } = recipeIds.length
    ? await supabase
        .from("recipes")
        .select(
          "id, servings, recipe_ingredients(ingredient_id, raw_text, quantity, unit, optional, ingredients(name))",
        )
        .in("id", recipeIds)
    : { data: [] };
  const recipes = (recipeRows ?? []).map((r) => ({
    id: r.id,
    servings: Number(r.servings),
    ingredients: (r.recipe_ingredients ?? [])
      .filter((i) => !i.optional)
      .map((i) => ({
        ingredientId: i.ingredient_id,
        name: i.ingredients?.name ?? i.raw_text ?? "",
        quantity: i.quantity === null ? null : Number(i.quantity),
        unit: i.unit,
      })),
  }));

  const ingredientIds = [
    ...new Set(
      recipes.flatMap((r) =>
        r.ingredients.flatMap((i) => (i.ingredientId ? [i.ingredientId] : [])),
      ),
    ),
  ];
  const { data: cat } = ingredientIds.length
    ? await supabase
        .from("ingredients")
        .select("id, aisle, unit_weight_g, shelf_life")
        .in("id", ingredientIds)
    : { data: [] };
  const catalog = (cat ?? []).map((c) => ({
    id: c.id,
    aisle: c.aisle,
    unitWeightG: c.unit_weight_g === null ? null : Number(c.unit_weight_g),
    maxFridgeDays: maxFridge(c.shelf_life),
  }));

  // Primera compra el día anterior al plan; segunda, a mitad de semana, solo si algo perecedero la necesita.
  // El menú ("Mis comidas") no tiene fechas: se compra todo junto, hoy.
  const isMenu = plan.week_start === MENU_DATE;
  const first = isMenu ? MENU_DATE : addDays(plan.week_start, -1);
  const second = isMenu ? first : addDays(plan.week_start, 3);
  const built = buildShoppingList({
    entries: (entries ?? []).map((e) => ({
      id: e.id,
      date: e.date ?? todayString(),
      quantity: e.quantity,
      recipeId: e.recipe_id,
      servings: e.servings === null ? null : Number(e.servings),
      leftoversOfEntryId: e.leftovers_of_entry_id,
      cookDate: e.cook_date,
    })),
    recipes,
    catalog,
    shopDates: isMenu ? [first] : [first, second],
  });
  const dates = [...new Set(built.map((i) => i.shopDate ?? first))].sort();
  const trips = dates.length > 0 ? dates : [first];

  const listIds: string[] = [];
  for (const shopDate of trips) {
    const items = built.filter((i) => (i.shopDate ?? first) === shopDate);
    const id = await upsertList(supabase, plan.group_id, plan.id, shopDate, items);
    if (!id.ok) return id;
    listIds.push(id.id);
  }
  // Si antes había una segunda compra que ya no hace falta, se archiva.
  const { data: others } = await supabase
    .from("shopping_lists")
    .select("id, shop_date")
    .eq("plan_id", plan.id)
    .neq("status", "archived");
  for (const l of others ?? []) {
    if (!listIds.includes(l.id)) {
      await supabase.from("shopping_lists").update({ status: "archived" }).eq("id", l.id);
    }
  }
  return { ok: true, listIds };
}

async function upsertList(
  supabase: Client,
  groupId: string,
  planId: string,
  shopDate: string,
  fresh: ShoppingItem[],
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data: found } = await supabase
    .from("shopping_lists")
    .select("id")
    .eq("plan_id", planId)
    .eq("shop_date", shopDate)
    .neq("status", "archived")
    .maybeSingle();

  let listId = found?.id;
  if (!listId) {
    const created = await supabase
      .from("shopping_lists")
      .insert({
        group_id: groupId,
        plan_id: planId,
        name: `Compra del ${dayLabel(shopDate).toLowerCase()}`,
        shop_date: shopDate,
      })
      .select("id")
      .single();
    if (created.error || !created.data) return { ok: false, error: "No se pudo crear la lista." };
    listId = created.data.id;
  }

  const { data: existingRows } = await supabase
    .from("shopping_list_items")
    .select("id, ingredient_id, display_name, state, is_manual, no_longer_needed")
    .eq("list_id", listId);
  const existing: ExistingItem[] = (existingRows ?? []).map((r) => ({
    id: r.id,
    ingredientId: r.ingredient_id,
    displayName: r.display_name,
    state: r.state as ExistingItem["state"],
    isManual: r.is_manual,
    noLongerNeeded: r.no_longer_needed,
  }));
  const merge = mergeShoppingItems(existing, fresh);

  const row = (i: ShoppingItem, position: number) => ({
    ingredient_id: i.ingredientId,
    display_name: i.displayName,
    quantity: i.quantity,
    unit: i.unit,
    purchase_hint: formatPurchaseQuantity(i.quantity, i.unit) || null,
    aisle: i.aisle,
    needed_by: i.neededBy,
    source_entry_ids: i.sourceEntryIds,
    pantry_staple: i.pantryStaple,
    position,
  });

  if (merge.deletes.length)
    await supabase.from("shopping_list_items").delete().in("id", merge.deletes);
  if (merge.markNoLongerNeeded.length)
    await supabase
      .from("shopping_list_items")
      .update({ no_longer_needed: true })
      .in("id", merge.markNoLongerNeeded);
  for (const u of merge.updates) {
    await supabase
      .from("shopping_list_items")
      .update({ ...row(u.item, 0), no_longer_needed: false })
      .eq("id", u.id);
  }
  if (merge.inserts.length) {
    const { error } = await supabase
      .from("shopping_list_items")
      .insert(merge.inserts.map((i, n) => ({ list_id: listId!, ...row(i, n) })));
    if (error) return { ok: false, error: "No se pudieron guardar los ítems." };
  }
  return { ok: true, id: listId };
}
