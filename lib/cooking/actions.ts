"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cookingEditsSchema } from "@/lib/schemas/cooking-edits";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const startSchema = z.object({
  recipeId: z.string().uuid(),
  servings: z.number().positive().max(1000),
  planEntryId: z.string().uuid().optional(),
});

/** Crea la sesión de cocina al tocar "Empezar". */
export async function startCookingSession(raw: unknown): Promise<Result<{ id: string }>> {
  const parsed = startSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();

  const { data: recipe } = await supabase
    .from("recipes")
    .select("id, current_version")
    .eq("id", parsed.data.recipeId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!recipe) return { ok: false, error: "No encontramos la receta." };

  const { data, error } = await supabase
    .from("cooking_sessions")
    .insert({
      recipe_id: recipe.id,
      recipe_version: recipe.current_version,
      servings: parsed.data.servings,
      plan_entry_id: parsed.data.planEntryId ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "No se pudo empezar la sesión." };
  return { ok: true, data: { id: data.id } };
}

const progressSchema = z.object({
  sessionId: z.string().uuid(),
  currentStep: z.number().int().min(0).max(500),
  servings: z.number().positive().max(1000).optional(),
  pendingEdits: cookingEditsSchema.optional(),
});

/** Guarda el paso actual, las porciones y los ajustes de la sesión. */
export async function updateCookingProgress(raw: unknown): Promise<Result<null>> {
  const parsed = progressSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("cooking_sessions")
    .update({
      current_step: parsed.data.currentStep,
      ...(parsed.data.servings ? { servings: parsed.data.servings } : {}),
      ...(parsed.data.pendingEdits ? { pending_edits: parsed.data.pendingEdits } : {}),
    })
    .eq("id", parsed.data.sessionId)
    .is("finished_at", null);
  if (error) return { ok: false, error: "No se pudo guardar el progreso." };
  return { ok: true, data: null };
}

/** "Empezar de nuevo": descarta la sesión a medias. */
export async function discardCookingSession(raw: unknown): Promise<Result<null>> {
  const parsed = z.object({ sessionId: z.string().uuid() }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("cooking_sessions")
    .delete()
    .eq("id", parsed.data.sessionId)
    .is("finished_at", null);
  if (error) return { ok: false, error: "No se pudo descartar la sesión." };
  return { ok: true, data: null };
}
