"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import {
  createGroupSchema,
  leaveGroupSchema,
  removeMemberSchema,
  renameGroupSchema,
  setGroupEmojiSchema,
  setMemberRoleSchema,
} from "@/lib/schemas/group";

type Result = { ok: true } | { ok: false; error: string };

function rpcError(error: { message?: string } | null, fallback: string): string {
  const msg = error?.message ?? "";
  if (msg.includes("Not authenticated")) return "Tu sesión venció. Volvé a entrar.";
  if (msg.includes("Forbidden") || msg.includes("permission")) return "No tenés permiso para hacer eso.";
  if (msg.includes("Cannot remove an owner")) return "No podés sacar a un dueño.";
  if (msg.includes("Cannot leave personal group")) return "No podés salir de tu grupo personal.";
  if (msg.includes("Cannot change own role")) return "No podés cambiarte el rol a vos mismo.";
  if (msg.includes("not a member")) return "Esa persona ya no está en el grupo.";
  if (msg.includes("Invalid role")) return "Rol inválido.";
  if (msg.includes("Name is required")) return "Poné un nombre.";
  return fallback;
}

export async function createGroup(
  raw: unknown,
): Promise<{ ok: true; groupId: string } | { ok: false; error: string }> {
  const parsed = createGroupSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Revisá el nombre." };
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_group", {
    p_name: parsed.data.name,
    p_emoji: parsed.data.emoji as string, // p_emoji es nullable en SQL; el tipo generado lo marca string
  });
  if (error || !data) return { ok: false, error: rpcError(error, "No se pudo crear el grupo.") };
  revalidatePath("/perfil");
  return { ok: true, groupId: data };
}

export async function renameGroup(raw: unknown): Promise<Result> {
  const parsed = renameGroupSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Revisá el nombre." };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("groups")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.groupId);
  if (error) return { ok: false, error: rpcError(error, "No se pudo guardar.") };
  revalidatePath(`/grupos/${parsed.data.groupId}`);
  return { ok: true };
}

export async function setGroupEmoji(raw: unknown): Promise<Result> {
  const parsed = setGroupEmojiSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Revisá el emoji." };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("groups")
    .update({ emoji: parsed.data.emoji })
    .eq("id", parsed.data.groupId);
  if (error) return { ok: false, error: rpcError(error, "No se pudo guardar.") };
  revalidatePath(`/grupos/${parsed.data.groupId}`);
  return { ok: true };
}

export async function setMemberRole(raw: unknown): Promise<Result> {
  const parsed = setMemberRoleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Rol inválido." };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_role", {
    gid: parsed.data.groupId,
    p_user_id: parsed.data.userId,
    p_role: parsed.data.role,
  });
  if (error) return { ok: false, error: rpcError(error, "No se pudo cambiar el rol.") };
  revalidatePath(`/grupos/${parsed.data.groupId}`);
  return { ok: true };
}

export async function removeMember(raw: unknown): Promise<Result> {
  const parsed = removeMemberSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", {
    gid: parsed.data.groupId,
    p_user_id: parsed.data.userId,
  });
  if (error) return { ok: false, error: rpcError(error, "No se pudo sacar a esa persona.") };
  revalidatePath(`/grupos/${parsed.data.groupId}`);
  return { ok: true };
}

export async function leaveGroup(raw: unknown): Promise<Result> {
  const parsed = leaveGroupSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_group", { gid: parsed.data.groupId });
  if (error) return { ok: false, error: rpcError(error, "No se pudo salir del grupo.") };
  revalidatePath("/perfil");
  return { ok: true };
}
