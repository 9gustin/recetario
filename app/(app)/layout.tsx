import { requireUser } from "@/lib/auth";
import { getMyGroups } from "@/lib/groups/queries";
import { BottomNav } from "@/components/shell/bottom-nav";
import { TopBar } from "@/components/shell/top-bar";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const groups = await getMyGroups(user.id);
  const defaultGroupId = groups.find((g) => g.is_personal)?.id ?? groups[0]?.id;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
      <TopBar groups={groups} />
      <main className="flex flex-1 flex-col pb-[calc(76px+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <BottomNav
        defaultGroupId={defaultGroupId}
        className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md"
      />
    </div>
  );
}
