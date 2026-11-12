"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getNow } from "@/lib/now";
import { hourIn } from "@/lib/domain/today";
import { todayString, weekStartOf } from "@/lib/domain/week";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  groupId: z.string().uuid(),
  recipeId: z.string().uuid(),
  catalog: z.boolean().optional(),
});

/**
 * "Elegir para hoy": suma la receta a hoy en el plan de la semana (se crea si no existe).
 * Si era una receta nueva en borrador, pasa a formar parte del recetario.
 */
export async function chooseForToday(
  raw: unknown,
): Promise<{ ok: true; data: null } | { ok: false; error: string }> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  const { groupId } = parsed.data;
  let recipeId = parsed.data.recipeId;
  const user = await requireUser();
  const supabase = await createClient();

  // Receta del catálogo: primero se guarda en el recetario del grupo.
  if (parsed.data.catalog) {
    const forked = await supabase.rpc("fork_published_recipe", {
      p_recipe_id: recipeId,
      p_target_group_id: groupId,
    });
    if (forked.error || !forked.data)
      return { ok: false, error: "No se pudo guardar la receta del catálogo." };
    recipeId = forked.data;
  }

  const { data: recipe } = await supabase
    .from("recipes")
    .select("id, status")
    .eq("id", recipeId)
    .eq("group_id", groupId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!recipe) return { ok: false, error: "No encontramos esa receta." };

  const { data: group } = await supabase
    .from("groups")
    .select("week_starts_on")
    .eq("id", groupId)
    .maybeSingle();
  const now = await getNow();
  const today = todayString(now);
  const weekStart = weekStartOf(today, group?.week_starts_on ?? 1);

  let { data: plan } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("group_id", groupId)
    .eq("week_start", weekStart)
    .neq("status", "archived")
    .maybeSingle();
  if (!plan) {
    const created = await supabase
      .from("meal_plans")
      .insert({ group_id: groupId, week_start: weekStart, created_by: user.id })
      .select("id")
      .single();
    if (created.error || !created.data) return { ok: false, error: "No se pudo crear el plan." };
    plan = created.data;
  }

  // Antes de las 15 h se asume almuerzo; después, cena. Si ese momento no está habilitado, el primero que haya.
  const { data: slotsRow } = await supabase
    .from("groups")
    .select("meal_slots")
    .eq("id", groupId)
    .maybeSingle();
  const wanted = hourIn(now) < 15 ? "lunch" : "dinner";
  const enabled = slotsRow?.meal_slots ?? [];
  const slot = enabled.includes(wanted) ? wanted : (enabled[0] ?? wanted);

  const isNew = recipe.status === "draft";
  const { error } = await supabase.from("meal_plan_entries").insert({
    plan_id: plan.id,
    date: today,
    slot,
    recipe_id: recipeId,
    is_new_recipe: isNew,
    position: 100,
  });
  if (error) return { ok: false, error: "No se pudo agregar a hoy." };
  if (isNew) {
    await supabase
      .from("recipes")
      .update({ status: "active", draft_for_plan_id: null })
      .eq("id", recipeId);
  }
  revalidatePath(`/g/${groupId}/hoy`);
  revalidatePath(`/g/${groupId}/plan`);
  revalidatePath(`/g/${groupId}/recetas`);
  return { ok: true, data: null };
}
