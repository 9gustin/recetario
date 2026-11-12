import "server-only";
import { sortSlots, type MealSlot } from "@/lib/domain/meal-slots";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { MENU_DATE } from "@/lib/domain/week";
import type { MenuEntry, PlanEntry, PlanMember, PlanRow } from "./types";

export const ENTRY_COLUMNS =
  "id, plan_id, date, slot, quantity, cooked_at, recipe_id, free_text, servings, diner_ids, cook_date, leftovers_of_entry_id, is_new_recipe, position, recipes(title, image_url, total_minutes, status, servings)";

type RawEntry = Omit<PlanEntry, "recipe" | "slot" | "servings"> & {
  slot: string;
  servings: number | string | null;
  recipes: {
    title: string;
    image_url: string | null;
    total_minutes: number | null;
    status: string;
    servings: number | string;
  } | null;
};

export function toPlanEntry(row: RawEntry): PlanEntry {
  const { recipes, ...rest } = row;
  return {
    ...rest,
    slot: row.slot as MealSlot,
    servings: row.servings === null ? null : Number(row.servings),
    recipe: recipes ? { ...recipes, servings: Number(recipes.servings) } : null,
  };
}

/** Momentos que usa el grupo y en qué día empieza su semana. */
export async function getGroupPlanSettings(groupId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("groups")
    .select("meal_slots, week_starts_on, name")
    .eq("id", groupId)
    .maybeSingle();
  return {
    name: data?.name ?? "",
    mealSlots: sortSlots(data?.meal_slots ?? []),
    weekStartsOn: data?.week_starts_on ?? 1,
  };
}

/** Plan vigente de una semana (si hay) con sus entradas y las recetas resumidas. */
export async function getPlanByWeek(
  groupId: string,
  weekStart: string,
): Promise<{ plan: PlanRow | null; entries: PlanEntry[] }> {
  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id, group_id, week_start, end_date, status, title, notes, approved_at")
    .eq("group_id", groupId)
    .eq("week_start", weekStart)
    .neq("status", "archived")
    .maybeSingle();
  if (!plan) return { plan: null, entries: [] };
  const { data: rows } = await supabase
    .from("meal_plan_entries")
    .select(ENTRY_COLUMNS)
    .eq("plan_id", plan.id)
    .not("date", "is", null)
    .order("date")
    .order("position");
  return {
    plan: plan as PlanRow,
    entries: (rows ?? []).map((r) => toPlanEntry(r as unknown as RawEntry)),
  };
}

/** Miembros del grupo (para elegir quiénes comen). */
export async function getPlanMembers(groupId: string): Promise<PlanMember[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("group_members")
    .select("user_id, profiles(display_name)")
    .eq("group_id", groupId);
  return (data ?? []).map((m) => ({
    id: m.user_id,
    name: m.profiles?.display_name?.trim() || "Alguien",
  }));
}

export type PlanHistoryItem = {
  id: string;
  week_start: string;
  end_date: string;
  status: string;
  entryCount: number;
  thumbs: string[];
};

/** Semanas anteriores con miniaturas. */
export async function getPlanHistory(groupId: string): Promise<PlanHistoryItem[]> {
  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("meal_plans")
    .select("id, week_start, end_date, status")
    .eq("group_id", groupId)
    .neq("status", "archived")
    .neq("week_start", MENU_DATE)
    .order("week_start", { ascending: false })
    .limit(20);
  const ids = (plans ?? []).map((p) => p.id);
  if (ids.length === 0) return [];
  const { data: entries } = await supabase
    .from("meal_plan_entries")
    .select("plan_id, recipes(image_url)")
    .in("plan_id", ids);
  const byPlan = new Map<string, { count: number; thumbs: string[] }>();
  for (const e of entries ?? []) {
    const cur = byPlan.get(e.plan_id) ?? { count: 0, thumbs: [] };
    cur.count++;
    const img = e.recipes?.image_url;
    if (img && cur.thumbs.length < 3) cur.thumbs.push(img);
    byPlan.set(e.plan_id, cur);
  }
  return (plans ?? []).map((p) => ({
    id: p.id,
    week_start: p.week_start,
    end_date: p.end_date,
    status: p.status,
    entryCount: byPlan.get(p.id)?.count ?? 0,
    thumbs: byPlan.get(p.id)?.thumbs ?? [],
  }));
}

/** Comidas de hoy y mañana del grupo (de cualquier plan no archivado), para la home. */
export async function getTodayEntries(groupId: string, today: string, tomorrow: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meal_plan_entries")
    .select(`${ENTRY_COLUMNS}, meal_plans!inner(group_id, status)`)
    .eq("meal_plans.group_id", groupId)
    .neq("meal_plans.status", "archived")
    .in("date", [today, tomorrow])
    .order("position");
  return (data ?? []).map((row) => toPlanEntry(row as unknown as RawEntry));
}

/** Entradas de un plan, ordenadas (para refrescar el tablero ante cambios en vivo). */
export async function getPlanEntries(
  planId: string,
  client?: SupabaseClient<Database>,
): Promise<PlanEntry[]> {
  const supabase = client ?? (await createClient());
  const { data } = await supabase
    .from("meal_plan_entries")
    .select(ENTRY_COLUMNS)
    .eq("plan_id", planId)
    .not("date", "is", null)
    .order("date")
    .order("position");
  return (data ?? []).map((r) => toPlanEntry(r as unknown as RawEntry));
}

/** Inicio del plan vigente que cubre `today`, si hay. */
export async function getCurrentPlanStart(groupId: string, today: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meal_plans")
    .select("week_start")
    .eq("group_id", groupId)
    .neq("status", "archived")
    .gte("end_date", today)
    .lte("week_start", today)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.week_start ?? null;
}

/** El menú del grupo ("Mis comidas") con sus comidas, de la más nueva a la más vieja. */
export async function getMenu(groupId: string): Promise<{ planId: string; entries: MenuEntry[] }> {
  const supabase = await createClient();
  const { data: planId } = await supabase.rpc("get_or_create_menu", { p_group_id: groupId });
  if (!planId) return { planId: "", entries: [] };
  const { data } = await supabase
    .from("meal_plan_entries")
    .select(ENTRY_COLUMNS)
    .eq("plan_id", planId)
    .order("created_at", { ascending: false });
  return {
    planId,
    entries: (data ?? []).map((r) => {
      const raw = r as unknown as RawEntry & { date: string | null; slot: string | null };
      return {
        ...toPlanEntry(raw as RawEntry),
        date: raw.date,
        slot: (raw.slot as MealSlot | null) ?? null,
      } satisfies MenuEntry;
    }),
  };
}
