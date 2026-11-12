import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Verifica que el usuario sea miembro del grupo; si no, 404. */
export default async function GroupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ groupId: string }>;
}) {
  const user = await requireUser();
  const { groupId } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) notFound();

  return <>{children}</>;
}
