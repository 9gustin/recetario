import type { MealSlot } from "@/lib/domain/meal-slots";

export type PlanStatus = "draft" | "approved" | "archived";

export type PlanRow = {
  id: string;
  group_id: string;
  week_start: string;
  end_date: string;
  status: PlanStatus;
  title: string | null;
  notes: string | null;
  approved_at: string | null;
};

export type EntryRecipe = {
  title: string;
  image_url: string | null;
  total_minutes: number | null;
  status: string;
  servings: number;
};

export type PlanEntry = {
  id: string;
  plan_id: string;
  date: string;
  slot: MealSlot;
  quantity: number;
  cooked_at: string | null;
  recipe_id: string | null;
  free_text: string | null;
  servings: number | null;
  diner_ids: string[];
  cook_date: string | null;
  leftovers_of_entry_id: string | null;
  is_new_recipe: boolean;
  position: number;
  recipe: EntryRecipe | null;
};

export type PlanMember = { id: string; name: string };

/** Comida del listado "Mis comidas": puede no tener día ni momento. */
export type MenuEntry = Omit<PlanEntry, "date" | "slot"> & {
  date: string | null;
  slot: MealSlot | null;
};
