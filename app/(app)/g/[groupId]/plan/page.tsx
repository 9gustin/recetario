import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { weekStartOf } from "@/lib/domain/week";
import { getGroupPlanSettings } from "@/lib/plan/queries";

export const metadata = { title: "Plan" };

/** Lleva a la semana actual (según el día en que empieza la semana del grupo). */
export default async function Page({ params }: { params: Promise<{ groupId: string }> }) {
  await requireUser();
  const { groupId } = await params;
  const settings = await getGroupPlanSettings(groupId);
  redirect(`/g/${groupId}/plan/${weekStartOf(new Date(), settings.weekStartsOn)}`);
}
