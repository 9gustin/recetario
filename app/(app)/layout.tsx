import { BottomNav } from "@/components/shell/bottom-nav";
import { TopBar } from "@/components/shell/top-bar";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
      <TopBar />
      <main className="flex flex-1 flex-col pb-[calc(76px+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <BottomNav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md" />
    </div>
  );
}
