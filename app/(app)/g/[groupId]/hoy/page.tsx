import { TodayView } from "@/components/today/today-view";
import { requireUser } from "@/lib/auth";
import { getNow } from "@/lib/now";
import { resolveToday, hourIn, type TodayEntry } from "@/lib/domain/today";
import { addDays, todayString } from "@/lib/domain/week";
import { getGroupPlanSettings, getTodayEntries } from "@/lib/plan/queries";
import { getTodayPrep } from "@/lib/prep/queries";
import { getActiveListProgress } from "@/lib/shopping/queries";

export const metadata = { title: "Hoy" };

export default async function Page({ params }: { params: Promise<{ groupId: string }> }) {
  await requireUser();
  const { groupId } = await params;
  const now = await getNow();
  const today = todayString(now);
  const tomorrow = addDays(today, 1);

  const [settings, rows, progress, prep] = await Promise.all([
    getGroupPlanSettings(groupId),
    getTodayEntries(groupId, today, tomorrow),
    getActiveListProgress(groupId),
    getTodayPrep(groupId, today),
  ]);

  const byId = new Map(rows.map((r) => [r.id, r]));
  const entries: TodayEntry[] = rows.map((r) => ({
    id: r.id,
    date: r.date,
    slot: r.slot,
    title: r.recipe?.title ?? r.free_text ?? "Comida",
    recipeId: r.recipe_id,
    isLeftover: r.leftovers_of_entry_id !== null && byId.has(r.leftovers_of_entry_id),
    imageUrl: r.recipe?.image_url ?? null,
    totalMinutes: r.recipe?.total_minutes ?? null,
  }));

  const resolution = resolveToday({ hour: hourIn(now), today, tomorrow, entries });
  return (
    <TodayView
      groupId={groupId}
      today={today}
      groupName={settings.name}
      resolution={resolution}
      warnings={[]}
      prep={prep}
      shopping={
        progress
          ? {
              listId: progress.list.id,
              name: progress.list.name,
              done: progress.done,
              total: progress.total,
            }
          : null
      }
    />
  );
}
