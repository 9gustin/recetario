import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MealLog } from "@/lib/domain/adherence";
import type { MealSlot } from "@/lib/domain/meal-slots";
import type { DietPlanFull } from "./types";

const PLAN_SELECT =
  "id, title, status, summary, starts_on, ends_on, next_checkup, rules, allowances, open_questions, version, diet_plan_meals(id, slot, days, formula, components, options, position), diet_plan_swaps(id, meal_id, original, replacement, reason)";

type Raw = NonNullable<Awaited<ReturnType<typeof fetchRaw>>>;

async function fetchRaw(filter: { id?: string; status?: string }) {
  const supabase = await createClient();
  let q = supabase.from("diet_plans").select(PLAN_SELECT);
  if (filter.id) q = q.eq("id", filter.id);
  if (filter.status) q = q.eq("status", filter.status);
  const { data } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data;
}

function shape(r: Raw): DietPlanFull {
  return {
    id: r.id,
    title: r.title,
    status: r.status as DietPlanFull["status"],
    summary: r.summary,
    starts_on: r.starts_on,
    ends_on: r.ends_on,
    next_checkup: r.next_checkup,
    rules: (r.rules as DietPlanFull["rules"]) ?? [],
    allowances: (r.allowances as DietPlanFull["allowances"]) ?? {},
    open_questions: (r.open_questions as string[]) ?? [],
    version: r.version,
    meals: [...(r.diet_plan_meals ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((m) => ({
        ...m,
        components: (m.components as DietPlanFull["meals"][number]["components"]) ?? [],
        options: (m.options as string[]) ?? [],
      })),
    swaps: r.diet_plan_swaps ?? [],
  };
}

export async function getDietPlan(id: string): Promise<DietPlanFull | null> {
  const r = await fetchRaw({ id });
  return r ? shape(r) : null;
}

export async function getActiveDietPlan(): Promise<DietPlanFull | null> {
  const r = await fetchRaw({ status: "active" });
  return r ? shape(r) : null;
}

export async function getMealLogs(from: string, to: string): Promise<MealLog[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meal_logs")
    .select("date, slot, status")
    .gte("date", from)
    .lte("date", to);
  return (data ?? []).map((l) => ({
    date: l.date,
    slot: l.slot as MealSlot,
    status: l.status as MealLog["status"],
  }));
}
