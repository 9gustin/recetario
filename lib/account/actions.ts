"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { DELETE_PHRASE } from "./constants";

async function removeFolder(bucket: string, folder: string) {
  const admin = createAdminClient();
  const { data } = await admin.storage.from(bucket).list(folder, { limit: 1000 });
  const paths = (data ?? []).filter((f) => f.id).map((f) => `${folder}/${f.name}`);
  if (paths.length) await admin.storage.from(bucket).remove(paths);
}

/**
 * Borra la cuenta: transfiere la propiedad de los grupos compartidos, borra lo personal (perfil alimentario,
 * archivos, planes de alimentación) y elimina el usuario de Auth. Pide escribir la frase de confirmación.
 */
export async function deleteAccount(raw: unknown): Promise<{ ok: false; error: string }> {
  const parsed = z.object({ confirm: z.string() }).safeParse(raw);
  if (!parsed.success || parsed.data.confirm.trim().toUpperCase() !== DELETE_PHRASE)
    return { ok: false, error: `Escribí «${DELETE_PHRASE}» para confirmar.` };

  const user = await requireUser();
  const admin = createAdminClient();

  // Archivos personales primero (después no hay cómo saber de quién eran).
  await Promise.all([
    removeFolder("profile-inputs", user.id),
    removeFolder("audio", user.id),
  ]).catch(() => undefined);

  const { error } = await admin.rpc("prepare_account_deletion", { p_user_id: user.id });
  if (error) return { ok: false, error: "No pudimos borrar tus datos. Probá de nuevo." };
  const { error: authError } = await admin.auth.admin.deleteUser(user.id);
  if (authError)
    return {
      ok: false,
      error: "Borramos tus datos, pero falló el cierre de la cuenta. Escribinos.",
    };

  await (await createClient()).auth.signOut();
  redirect("/login?deleted=1");
}
