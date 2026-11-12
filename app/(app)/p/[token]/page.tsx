import { notFound, redirect } from "next/navigation";
import { AcceptLink } from "@/components/pro/accept-link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Invitación de tu profesional" };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  await requireUser();
  const { token } = await params;
  if (!/^[0-9a-f]{16,64}$/i.test(token)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_pro_link_invite", { p_token: token });
  const invite = data?.[0];
  if (!invite || invite.status === "revoked") notFound();
  if (invite.mine) redirect("/perfil/profesional");
  return (
    <div className="flex flex-col gap-5 pt-5 pb-8">
      <h1 className="px-5 font-display text-[30px] leading-[1.05] font-normal">
        Conectar con tu profesional
      </h1>
      <AcceptLink token={token} proName={invite.pro_name} />
    </div>
  );
}
