import { HistoryList } from "@/components/plan/history-list";
import { requireUser } from "@/lib/auth";
import { addDays, todayString, weekStartOf } from "@/lib/domain/week";
import { getGroupPlanSettings, getPlanHistory } from "@/lib/plan/queries";

export const metadata = { title: "Historial del plan" };

export default async function Page({ params }: { params: Promise<{ groupId: string }> }) {
  await requireUser();
  const { groupId } = await params;
  const [settings, items] = await Promise.all([
    getGroupPlanSettings(groupId),
    getPlanHistory(groupId),
  ]);
  const current = weekStartOf(todayString(), settings.weekStartsOn);
  const existing = new Set(items.map((i) => i.week_start));
  // Se repite en la próxima semana que todavía no tenga plan.
  let target = addDays(current, 7);
  while (existing.has(target)) target = addDays(target, 7);

  return (
    <div className="flex flex-1 flex-col gap-2">
      <h2 className="px-5 pt-1 font-display text-[30px] leading-[1.05] font-normal">Historial</h2>
      <HistoryList groupId={groupId} items={items} targetWeek={target} />
    </div>
  );
}
