import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/pro/register-form";
import { requireUser } from "@/lib/auth";
import { getProProfile } from "@/lib/pro/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Cuenta profesional" };

export default async function Page() {
  const user = await requireUser();
  if (await getProProfile(user.id)) redirect("/pro");
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();
  return (
    <div className="flex flex-col gap-5 pt-5 pb-8">
      <header className="flex flex-col gap-1 px-5">
        <h1 className="font-display text-[30px] leading-[1.05] font-normal">Cuenta profesional</h1>
        <p className="text-sm text-muted">Ingresá el código que te pasamos.</p>
      </header>
      <RegisterForm defaultName={data?.display_name ?? ""} />
    </div>
  );
}
