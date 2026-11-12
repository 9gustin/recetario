import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { getMyGroups } from "@/lib/groups/queries";
import { getUnresolvedInboxCount } from "@/lib/inbox/queries";
import { BottomNav } from "@/components/shell/bottom-nav";
import { TopBar } from "@/components/shell/top-bar";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const [groups, inboxCount] = await Promise.all([getMyGroups(user.id), getUnresolvedInboxCount()]);
  // Fuera de /g/<id> (Perfil, Grupos…) se vuelve al último grupo visitado, no al personal.
  const lastId = (await cookies()).get("last_group_id")?.value;
  const defaultGroupId =
    groups.find((g) => g.id === lastId)?.id ??
    groups.find((g) => g.is_personal)?.id ??
    groups[0]?.id;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
      <TopBar groups={groups} defaultGroupId={defaultGroupId} />
      <main className="flex flex-1 flex-col pb-[calc(76px+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <BottomNav
        defaultGroupId={defaultGroupId}
        inboxCount={inboxCount}
        className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md"
      />
    </div>
  );
}
