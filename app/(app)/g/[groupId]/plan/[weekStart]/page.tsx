import { notFound, redirect } from "next/navigation";
import { PlanBoard } from "@/components/plan/plan-board";
import { requireUser } from "@/lib/auth";
import { todayString, weekStartOf } from "@/lib/domain/week";
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
  await requireUser();
  const { groupId, weekStart } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) notFound();

  const settings = await getGroupPlanSettings(groupId);
  // Cualquier fecha lleva al primer día de su semana.
  const normalized = weekStartOf(weekStart, settings.weekStartsOn);
  if (normalized !== weekStart) redirect(`/g/${groupId}/plan/${normalized}`);

  const [{ plan, entries }, members, history] = await Promise.all([
    getPlanByWeek(groupId, weekStart),
    getPlanMembers(groupId),
    getPlanHistory(groupId),
  ]);

  return (
    <PlanBoard
      key={`${weekStart}-${plan?.id ?? "none"}`}
      groupId={groupId}
      weekStart={weekStart}
      today={todayString()}
      plan={plan}
      initialEntries={entries}
      members={members}
      mealSlots={settings.mealSlots}
      history={history.filter((h) => h.week_start !== weekStart)}
    />
  );
}
