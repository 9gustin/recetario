import { notFound, redirect } from "next/navigation";
import { PatientView } from "@/components/pro/patient-view";
import { requireUser } from "@/lib/auth";
import { addDays, todayString } from "@/lib/domain/week";
import {
  getDeliveries,
  getPatientLog,
  getProLink,
  getProPlans,
  getProProfile,
} from "@/lib/pro/queries";

export const metadata = { title: "Paciente" };

export default async function Page({ params }: { params: Promise<{ linkId: string }> }) {
  const user = await requireUser();
  if (!(await getProProfile(user.id))) redirect("/pro/registro");
  const { linkId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(linkId)) notFound();
  const link = await getProLink(linkId);
  if (!link || link.pro_id !== user.id) notFound();

  const to = todayString();
  const from = addDays(to, -13);
  const [plans, deliveries, log] = await Promise.all([
    getProPlans(),
    getDeliveries([link.id]),
    link.status === "active" && link.share_meals ? getPatientLog(link.id, from, to) : null,
  ]);
  return (
    <div className="flex flex-col gap-4 pt-5">
      <header className="px-5">
        <h1 className="font-display text-[30px] leading-[1.05] font-normal">{link.label}</h1>
      </header>
      <PatientView
        link={link}
        plans={plans}
        deliveries={deliveries}
        log={log}
        from={from}
        to={to}
      />
    </div>
  );
}
