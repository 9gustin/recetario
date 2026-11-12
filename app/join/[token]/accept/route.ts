import { NextResponse } from "next/server";
import { displayName, notifyGroup } from "@/lib/inbox/notify";
import { createClient } from "@/lib/supabase/server";

/** Acepta la invitación (POST) y redirige al grupo con un toast de bienvenida. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", `/join/${token}`);
    return NextResponse.redirect(url);
  }

  const { data: groupId, error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error || !groupId) {
    return NextResponse.redirect(new URL(`/join/${token}`, request.url));
  }

  const { data: group } = await supabase
    .from("groups")
    .select("name")
    .eq("id", groupId)
    .maybeSingle();

  void displayName(user.id).then((name) =>
    notifyGroup({
      groupId,
      fromUserId: user.id,
      kind: "member_joined",
      message: `${name} se sumó a ${group?.name ?? "el grupo"}`,
      url: `/g/${groupId}/hoy`,
    }),
  );

  const url = new URL(`/g/${groupId}/hoy`, request.url);
  url.searchParams.set("joined", group?.name ?? "el grupo");
  return NextResponse.redirect(url);
}
