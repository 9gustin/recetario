import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type GroupSummary = {
  id: string;
  name: string;
  emoji: string | null;
  is_personal: boolean;
  role: string;
  member_count: number;
};

/** Grupos a los que pertenece el usuario, con cantidad de miembros y su rol. */
export const getMyGroups = cache(async (userId: string): Promise<GroupSummary[]> => {
  const supabase = await createClient();

  const { data: memberships, error } = await supabase
    .from("group_members")
    .select("group_id, role, groups(id, name, emoji, is_personal)")
    .eq("user_id", userId);

  if (error || !memberships) return [];

  const groupIds = memberships.map((m) => m.group_id);
  const { data: memberRows } = await supabase
    .from("group_members")
    .select("group_id")
    .in("group_id", groupIds);

  const countByGroup = new Map<string, number>();
  for (const row of memberRows ?? []) {
    countByGroup.set(row.group_id, (countByGroup.get(row.group_id) ?? 0) + 1);
  }

  return memberships.map((m) => ({
    id: m.group_id,
    name: m.groups?.name ?? "",
    emoji: m.groups?.emoji ?? null,
    is_personal: m.groups?.is_personal ?? false,
    role: m.role,
    member_count: countByGroup.get(m.group_id) ?? 1,
  }));
});
