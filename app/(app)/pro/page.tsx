import { redirect } from "next/navigation";
import { ProPanel } from "@/components/pro/panel";
import { requireUser } from "@/lib/auth";
import { getProLinks, getProPlans, getProProfile } from "@/lib/pro/queries";

export const metadata = { title: "Panel profesional" };

export default async function Page() {
  const user = await requireUser();
  const pro = await getProProfile(user.id);
  if (!pro) redirect("/pro/registro");
  const [links, plans] = await Promise.all([getProLinks(user.id), getProPlans()]);
  return (
    <div className="flex flex-col gap-4 pt-5">
      <header className="px-5">
        <p className="text-xs font-bold tracking-wide text-accent uppercase">Panel profesional</p>
        <h1 className="font-display text-[30px] leading-[1.05] font-normal">{pro.display_name}</h1>
      </header>
      <ProPanel links={links} plans={plans} />
    </div>
  );
}
