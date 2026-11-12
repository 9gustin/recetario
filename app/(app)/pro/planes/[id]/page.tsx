import { notFound, redirect } from "next/navigation";
import { PlanEditor } from "@/components/pro/plan-editor";
import { requireUser } from "@/lib/auth";
import { getProPlan, getProProfile } from "@/lib/pro/queries";

export const metadata = { title: "Plan profesional" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!(await getProProfile(user.id))) redirect("/pro/registro");
  const { id } = await params;
  let data = null;
  if (id !== "nuevo") {
    if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
    data = await getProPlan(id);
    if (!data) notFound();
  }
  return (
    <div className="flex flex-col gap-4 pt-5">
      <h1 className="px-5 font-display text-[30px] leading-[1.05] font-normal">
        {data ? data.plan.title : "Nuevo plan"}
      </h1>
      <PlanEditor key={id} plan={data?.plan ?? null} items={data?.items ?? []} />
    </div>
  );
}
