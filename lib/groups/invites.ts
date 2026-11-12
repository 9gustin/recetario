"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

type Invite = { id: string; token: string; expires_at: string | null };

function days(n: number) {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();
}

const groupIdSchema = z.object({ groupId: z.string().uuid() });
const revokeSchema = z.object({ groupId: z.string().uuid(), inviteId: z.string().uuid() });

export async function createInvite(
  raw: unknown,
): Promise<{ ok: true; invite: Invite } | { ok: false; error: string }> {
  const parsed = groupIdSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };

  const user = await requireUser();
  const supabase = await createClient();

  const token = randomBytes(24).toString("base64url");
  const { data, error } = await supabase
    .from("group_invites")
    .insert({
      group_id: parsed.data.groupId,
      token,
      created_by: user.id,
      expires_at: days(7),
    })
    .select("id, token, expires_at")
    .single();

  if (error || !data) return { ok: false, error: "No se pudo crear el link." };

  revalidatePath(`/grupos/${parsed.data.groupId}`);
  return { ok: true, invite: data };
}

export async function revokeInvite(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = revokeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };

  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("group_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", parsed.data.inviteId)
    .eq("group_id", parsed.data.groupId);

  if (error) return { ok: false, error: "No se pudo revocar el link." };

  revalidatePath(`/grupos/${parsed.data.groupId}`);
  return { ok: true };
}
