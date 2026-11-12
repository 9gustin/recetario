import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PrepTaskRow } from "./actions";

const COLS = "id, plan_id, title, details, suggested_date, duration_minutes, kind, done_at";

export async function getPrepTasks(
  planId: string,
): Promise<{ tasks: PrepTaskRow[]; tips: string[] }> {
  const supabase = await createClient();
  const [{ data: tasks }, { data: plan }] = await Promise.all([
    supabase.from("prep_tasks").select(COLS).eq("plan_id", planId).order("suggested_date"),
    supabase.from("meal_plans").select("prep_tips").eq("id", planId).maybeSingle(),
  ]);
  return { tasks: tasks ?? [], tips: (plan?.prep_tips as string[] | null) ?? [] };
}

/** Preparaciones de hoy del grupo (para la home). */
export async function getTodayPrep(groupId: string, today: string): Promise<PrepTaskRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("prep_tasks")
    .select(`${COLS}, meal_plans!inner(group_id, status)`)
    .eq("meal_plans.group_id", groupId)
    .neq("meal_plans.status", "archived")
    .eq("suggested_date", today);
  return (data ?? []).map(({ meal_plans: _mp, ...row }) => {
    void _mp;
    return row;
  });
}
