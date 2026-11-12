import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { todayString, weekStartOf } from "@/lib/domain/week";
import { getCurrentPlanStart, getGroupPlanSettings } from "@/lib/plan/queries";

export const metadata = { title: "Plan" };

/** Lleva al plan vigente (el que cubre hoy); si no hay, a la semana actual vacía. */
export default async function Page({ params }: { params: Promise<{ groupId: string }> }) {
  await requireUser();
  const { groupId } = await params;
  const today = todayString();
  const [current, settings] = await Promise.all([
    getCurrentPlanStart(groupId, today),
    getGroupPlanSettings(groupId),
  ]);
  redirect(`/g/${groupId}/plan/${current ?? weekStartOf(new Date(), settings.weekStartsOn)}`);
}
