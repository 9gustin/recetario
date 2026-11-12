import { createClient } from "@/lib/supabase/server";
import { getPrepTasks } from "@/lib/prep/queries";
import { notFound } from "next/navigation";
import { PlanBoard } from "@/components/plan/plan-board";
import { requireUser } from "@/lib/auth";
import { todayString } from "@/lib/domain/week";
import {
  getGroupPlanSettings,
  getPlanByWeek,
  getPlanHistory,
  getPlanMembers,
} from "@/lib/plan/queries";

export const metadata = { title: "Plan" };

export default async function Page({
  params,
}: {
  params: Promise<{ groupId: string; weekStart: string }>;
}) {
  const user = await requireUser();
  const { groupId, weekStart } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) notFound();

  const settings = await getGroupPlanSettings(groupId);

  const [{ plan, entries }, members, history] = await Promise.all([
    getPlanByWeek(groupId, weekStart),
    getPlanMembers(groupId),
    getPlanHistory(groupId),
  ]);

  const prep = plan ? await getPrepTasks(plan.id) : { tasks: [], tips: [] };
  const { data: share } = plan
    ? await (
        await createClient()
      )
        .from("plan_shares")
        .select("slug, title")
        .eq("plan_id", plan.id)
        .maybeSingle()
    : { data: null };

  return (
    <PlanBoard
      key={weekStart}
      groupId={groupId}
      weekStart={weekStart}
      today={todayString()}
      plan={plan}
      initialEntries={entries}
      members={members}
      currentUserId={user.id}
      shareSlug={share?.slug ?? null}
      prepTasks={prep.tasks}
      prepTips={prep.tips}
      mealSlots={settings.mealSlots}
      history={history.filter((h) => h.week_start !== weekStart)}
    />
  );
}
