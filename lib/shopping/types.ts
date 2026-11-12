export type ListItem = {
  id: string;
  list_id: string;
  ingredient_id: string | null;
  display_name: string;
  quantity: number | null;
  unit: string | null;
  purchase_hint: string | null;
  aisle: string;
  state: "pending" | "bought" | "have_it";
  state_by: string | null;
  note: string | null;
  is_manual: boolean;
  pantry_staple: boolean;
  no_longer_needed: boolean;
  needed_by: string | null;
  shelf_life_warning: string | null;
  position: number;
};

export type ListRow = {
  id: string;
  group_id: string;
  name: string;
  status: string;
  shop_date: string | null;
};

export const ITEM_COLUMNS =
  "id, list_id, ingredient_id, display_name, quantity, unit, purchase_hint, aisle, state, state_by, note, is_manual, pantry_staple, no_longer_needed, needed_by, shelf_life_warning, position";
