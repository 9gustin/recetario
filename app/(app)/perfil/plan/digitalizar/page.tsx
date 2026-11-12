import { Digitize } from "@/components/diet-plan/digitize";
import { requireUser } from "@/lib/auth";
import { getDietPlan } from "@/lib/diet-plan/queries";

export const metadata = { title: "Digitalizar mi plan" };

export default async function Page({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  await requireUser();
  const { plan } = await searchParams;
  const initial = plan && /^[0-9a-f-]{36}$/i.test(plan) ? await getDietPlan(plan) : null;
  return <Digitize initialPlan={initial} />;
}
