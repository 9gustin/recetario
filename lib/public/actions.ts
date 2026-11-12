"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

/** Guarda una receta pública en uno de mis grupos (queda como copia para editar). */
export async function savePublishedRecipe(
  raw: unknown,
): Promise<
  { ok: true; data: { recipeId: string; groupId: string } } | { ok: false; error: string }
> {
  const parsed = z.object({ recipeId: uuid, groupId: uuid }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fork_published_recipe", {
    p_recipe_id: parsed.data.recipeId,
    p_target_group_id: parsed.data.groupId,
  });
  if (error || !data) return { ok: false, error: "No se pudo guardar la receta." };
  return { ok: true, data: { recipeId: data, groupId: parsed.data.groupId } };
}

/** Copia un plan público a una semana de mi grupo (borrador, con sus recetas guardadas). */
export async function copyPublicPlan(
  raw: unknown,
): Promise<{ ok: true; data: { planId: string } } | { ok: false; error: string }> {
  const parsed = z
    .object({
      slug: z.string().max(140),
      groupId: uuid,
      weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("copy_public_plan", {
    p_slug: parsed.data.slug,
    p_group_id: parsed.data.groupId,
    p_week_start: parsed.data.weekStart,
  });
  if (error || !data)
    return {
      ok: false,
      error:
        error?.code === "23505" ? "Ya hay un plan para esa semana." : "No se pudo copiar el plan.",
    };
  return { ok: true, data: { planId: data } };
}
