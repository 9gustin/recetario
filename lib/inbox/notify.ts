import "server-only";
import { notifyUser } from "@/lib/push/send";
import { createAdminClient } from "@/lib/supabase/admin";

export type GroupInboxKind = "plan_approved" | "member_joined" | "list_done";

/**
 * Avisa a los demás miembros del grupo: crea un ítem en su bandeja y, si lo permiten, manda un push.
 * Nunca falla hacia afuera: es un extra de la acción que lo dispara.
 */
export async function notifyGroup(args: {
  groupId: string;
  fromUserId: string;
  kind: GroupInboxKind;
  message: string;
  url: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: members } = await admin
      .from("group_members")
      .select("user_id")
      .eq("group_id", args.groupId);
    const others = (members ?? []).map((m) => m.user_id).filter((id) => id !== args.fromUserId);
    if (others.length === 0) return;
    await admin.from("inbox_items").insert(
      others.map((user_id) => ({
        user_id,
        kind: args.kind,
        from_user_id: args.fromUserId,
        payload: { message: args.message, url: args.url, group_id: args.groupId },
      })),
    );
    await Promise.all(
      others.map((id) =>
        notifyUser(id, "inbox", { title: "Recetario", body: args.message, url: args.url }),
      ),
    );
  } catch {
    // Es un extra.
  }
}

export async function displayName(userId: string): Promise<string> {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  return data?.display_name?.trim() || "Alguien";
}
