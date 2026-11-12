import { MenuView } from "@/components/menu/menu-view";
import { requireUser } from "@/lib/auth";
import { todayString, weekStartOf } from "@/lib/domain/week";
import { getGroupPlanSettings, getMenu, getPlanMembers } from "@/lib/plan/queries";
import { getListItems, getPlanList } from "@/lib/shopping/queries";

export const metadata = { title: "Mis comidas" };

/** "Mis comidas": listado simple de lo que querés cocinar, con las compras debajo. */
export default async function Page({ params }: { params: Promise<{ groupId: string }> }) {
  await requireUser();
  const { groupId } = await params;
  const [menu, members, settings] = await Promise.all([
    getMenu(groupId),
    getPlanMembers(groupId),
    getGroupPlanSettings(groupId),
  ]);
  const list = menu.planId ? await getPlanList(menu.planId) : null;
  const items = list ? await getListItems(list.id) : [];
  return (
    <MenuView
      groupId={groupId}
      planId={menu.planId}
      initialEntries={menu.entries}
      initialSnapshot={{ listId: list?.id ?? null, items }}
      members={members}
      weekHref={`/g/${groupId}/plan/${weekStartOf(todayString(), settings.weekStartsOn)}`}
    />
  );
}
