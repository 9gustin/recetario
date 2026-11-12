import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { GroupSettings } from "@/components/groups/group-settings";

export const metadata = { title: "Grupo" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  const { data: group } = await supabase
    .from("groups")
    .select("id, name, emoji, is_personal")
    .eq("id", id)
    .maybeSingle();
  if (!group) notFound();

  const { data: members } = await supabase
    .from("group_members")
    .select("user_id, role, profiles(display_name)")
    .eq("group_id", id)
    .order("joined_at", { ascending: true });

  const myRole = members?.find((m) => m.user_id === user.id)?.role;
  if (!myRole) notFound();

  const { data: invites } = await supabase
    .from("group_invites")
    .select("id, token, expires_at")
    .eq("group_id", id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  return (
    <main className="flex flex-col gap-6 px-5 pt-5">
      <GroupSettings
        group={{ id: group.id, name: group.name, emoji: group.emoji, is_personal: group.is_personal }}
        members={(members ?? []).map((m) => ({
          user_id: m.user_id,
          role: m.role,
          display_name: m.profiles?.display_name ?? null,
        }))}
        myRole={myRole}
        myUserId={user.id}
        invites={(invites ?? []).map((i) => ({
          id: i.id,
          token: i.token,
          expires_at: i.expires_at,
        }))}
      />
    </main>
  );
}
