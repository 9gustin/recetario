import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
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

      <form action="/auth/signout" method="post" className="mt-auto">
        <PillButton type="submit" variant="outline" fullWidth>
          Cerrar sesión
        </PillButton>
      </form>
    </main>
  );
}
