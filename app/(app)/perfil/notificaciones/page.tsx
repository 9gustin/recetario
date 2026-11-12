import { NotificationsSettings } from "@/components/push/notifications-settings";
import { requireUser } from "@/lib/auth";
import { DEFAULT_PREFS, type Prefs } from "@/lib/domain/quiet-hours";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Notificaciones" };

export default async function Page() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notification_prefs")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const prefs: Prefs = data
    ? {
        prep: data.prep,
        thaw: data.thaw,
        timers: data.timers,
        inbox: data.inbox,
        quiet_start: data.quiet_start,
        quiet_end: data.quiet_end,
      }
    : DEFAULT_PREFS;
  return (
    <main className="flex flex-col gap-4 px-5 pt-5 pb-8">
      <h1 className="font-display text-[28px] leading-[1.05] font-normal">Notificaciones</h1>
      <NotificationsSettings initial={prefs} />
    </main>
  );
}
