import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PillButton } from "@/components/shared/pill-button";

export const metadata = { title: "Invitación" };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: previews } = await supabase.rpc("get_invite_preview", { p_token: token });
  const preview = previews?.[0];

  const isValid = preview?.is_valid === true;

  // Sin sesión: invitar a entrar.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isValid && !user) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
        <section className="bg-hero px-5 pt-[calc(env(safe-area-inset-top)+28px)] pb-6 text-foreground">
          <p className="text-[13px] font-bold tracking-[0.1em] text-foreground/80 uppercase">
            Te invitaron a
          </p>
          <h1 className="mt-2 font-display text-[40px] leading-[1.02] font-normal">
            {preview.group_name}
          </h1>
          <p className="mt-2 max-w-[280px] text-sm text-foreground/80">
            {preview.inviter_name
              ? `${preview.inviter_name} te invita a unirte.`
              : "Alguien te invita a unirte."}{" "}
            {preview.member_count > 0 ? `Ya son ${preview.member_count}.` : ""}
          </p>
        </section>
        <div className="flex flex-col gap-4 px-5 py-6">
          <PillButton asChild fullWidth>
            <Link href={`/login?next=${encodeURIComponent(`/join/${token}`)}`}>
              Entrá para unirte
            </Link>
          </PillButton>
        </div>
      </main>
    );
  }

  if (isValid && user) {
    // ¿Ya es miembro? Redirige directo.
    const { data: membership } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("group_id", preview.group_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membership) redirect(`/g/${preview.group_id}/hoy`);

    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
        <section className="bg-hero px-5 pt-[calc(env(safe-area-inset-top)+28px)] pb-6 text-foreground">
          <p className="text-[13px] font-bold tracking-[0.1em] text-foreground/80 uppercase">
            Te invitaron a
          </p>
          <h1 className="mt-2 font-display text-[40px] leading-[1.02] font-normal">
            {preview.group_name}
          </h1>
          <p className="mt-2 max-w-[280px] text-sm text-foreground/80">
            {preview.inviter_name
              ? `${preview.inviter_name} te invita a unirte.`
              : "Alguien te invita a unirte."}
          </p>
        </section>
        <div className="flex flex-col gap-4 px-5 py-6">
          <form action={`/join/${token}/accept`} method="post">
            <PillButton type="submit" fullWidth>
              Unirme
            </PillButton>
          </form>
        </div>
      </main>
    );
  }

  // Inválida / vencida / revocada.
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
      <section className="bg-hero px-5 pt-[calc(env(safe-area-inset-top)+28px)] pb-6 text-foreground">
        <p className="text-[13px] font-bold tracking-[0.1em] text-foreground/80 uppercase">
          Invitación
        </p>
        <h1 className="mt-2 font-display text-[40px] leading-[1.02] font-normal">
          Este link ya no está disponible
        </h1>
        <p className="mt-2 max-w-[280px] text-sm text-foreground/80">
          Puede que haya vencido o que lo hayan revocado. Pedile a quien te invitó que te mande uno
          nuevo.
        </p>
      </section>
      <div className="flex flex-col gap-4 px-5 py-6">
        <PillButton asChild variant="outline" fullWidth>
          <Link href="/">Ir al inicio</Link>
        </PillButton>
      </div>
    </main>
  );
}
