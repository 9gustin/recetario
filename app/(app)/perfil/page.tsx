import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Bell, ClipboardList, History, ShieldCheck, Inbox, Salad } from "lucide-react";
import { getUnresolvedInboxCount } from "@/lib/inbox/queries";
import { EditNameForm } from "@/components/profile/edit-name-form";
import { PillButton } from "@/components/shared/pill-button";

export const metadata = { title: "Perfil" };

export default async function Page() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .single();

  const inboxCount = await getUnresolvedInboxCount();
  const name = profile?.display_name ?? user.email ?? "";
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <main className="flex flex-col gap-6 px-5 pt-5">
      <header className="flex items-center gap-4">
        <span className="flex size-14 flex-none items-center justify-center rounded-full bg-accent font-display text-[26px] text-accent-foreground">
          {initial}
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-display text-[28px] leading-none font-normal">{name}</h1>
          <p className="mt-1 truncate text-[13px] text-muted">{user.email}</p>
        </div>
      </header>

      <EditNameForm currentName={name} />

      <Link
        href="/perfil/alimentacion"
        className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-surface px-4"
      >
        <Salad className="size-5" aria-hidden="true" />
        <span className="flex-1 text-[15px] font-semibold">Mi alimentación</span>
      </Link>

      <Link
        href="/perfil/plan"
        className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-surface px-4"
      >
        <ClipboardList className="size-5" aria-hidden="true" />
        <span className="flex-1 text-[15px] font-semibold">Mi plan</span>
      </Link>

      <Link
        href="/perfil/notificaciones"
        className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-surface px-4"
      >
        <Bell className="size-5" aria-hidden="true" />
        <span className="flex-1 text-[15px] font-semibold">Notificaciones</span>
      </Link>

      <Link
        href="/perfil/actividad"
        className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-surface px-4"
      >
        <History className="size-5" aria-hidden="true" />
        <span className="flex-1 text-[15px] font-semibold">Actividad</span>
      </Link>

      <Link
        href="/perfil/datos"
        className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-surface px-4"
      >
        <ShieldCheck className="size-5" aria-hidden="true" />
        <span className="flex-1 text-[15px] font-semibold">Mis datos</span>
      </Link>

      <Link
        href="/perfil/bandeja"
        className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-surface px-4"
      >
        <Inbox className="size-5" aria-hidden="true" />
        <span className="flex-1 text-[15px] font-semibold">Bandeja</span>
        {inboxCount > 0 ? (
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">
            {inboxCount}
          </span>
        ) : null}
      </Link>

      <form action="/auth/signout" method="post" className="mt-auto">
        <PillButton type="submit" variant="outline" fullWidth>
          Cerrar sesión
        </PillButton>
      </form>
    </main>
  );
}
