import { MyPros } from "@/components/pro/my-pros";
import { requireUser } from "@/lib/auth";
import { getAccessLog, getDeliveries, getMyProLinks } from "@/lib/pro/queries";
import { getMyGroups } from "@/lib/groups/queries";

export const metadata = { title: "Mis profesionales" };

export default async function Page() {
  const user = await requireUser();
  const [links, groups] = await Promise.all([getMyProLinks(user.id), getMyGroups(user.id)]);
  const ids = links.map((l) => l.id);
  const [deliveries, access] = await Promise.all([getDeliveries(ids), getAccessLog(ids)]);
  return (
    <div className="flex flex-col gap-4 pt-5">
      <h1 className="px-5 font-display text-[30px] leading-[1.05] font-normal">
        Mis profesionales
      </h1>
      <MyPros
        links={links}
        deliveries={deliveries}
        groups={groups.map((g) => ({ id: g.id, name: g.name, is_personal: g.is_personal }))}
        access={access}
      />
    </div>
  );
}
