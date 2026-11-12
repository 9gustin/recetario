"use server";

import { logEvent } from "@/lib/activity/log";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  applyCookingEdits,
  autoChangeNote,
  summarizeEdits,
} from "@/lib/domain/apply-cooking-edits";
import { getRecipe } from "@/lib/recipes/queries";
import { saveRecipe } from "@/lib/recipes/actions";
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const finishSchema = z.object({
  sessionId: z.string().uuid(),
  rating: z.number().int().min(1).max(5).optional(),
  note: z.string().trim().max(500).optional(),
  photoUrl: z.string().url().max(600).optional(),
  /** Si la receta no tiene foto, usar la del plato como portada. */
  useAsCover: z.boolean().default(false),
  /** Guardar los ajustes en la receta (versión nueva) o dejarlos solo para esta vez. */
  saveToRecipe: z.boolean().default(false),
  edits: cookingEditsSchema.default([]),
});

/** Termina la sesión: guarda puntaje, nota y foto, y (opcional) los ajustes como versión nueva. */
export async function finishCookingSession(
  raw: unknown,
): Promise<Result<{ savedVersion: number | null }>> {
  const parsed = finishSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Revisá los datos." };
  const input = parsed.data;

  const user = await requireUser();
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("cooking_sessions")
    .select("id, recipe_id")
    .eq("id", input.sessionId)
    .is("finished_at", null)
    .maybeSingle();
  if (!session) return { ok: false, error: "No encontramos la sesión." };

  const recipe = await getRecipe(session.recipe_id, user.id);
  if (!recipe) return { ok: false, error: "No encontramos la receta." };

  let savedVersion: number | null = null;
  if (input.saveToRecipe && input.edits.length > 0) {
    const base = { ingredients: recipe.ingredients, steps: recipe.steps };
    const lines = summarizeEdits(base, input.edits);
    if (lines.length > 0) {
      const applied = applyCookingEdits(base, input.edits);
      const saved = await saveRecipe({
        id: recipe.id,
        group_id: recipe.group_id,
        title: recipe.title,
        description: recipe.description,
        image_url: recipe.image_url,
        servings: recipe.servings,
        prep_minutes: recipe.prep_minutes,
        cook_minutes: recipe.cook_minutes,
        total_minutes: recipe.total_minutes,
        difficulty: recipe.difficulty,
        tags: recipe.tags,
        source_type: recipe.source_type,
        source_url: recipe.source_url,
        ingredients: applied.ingredients.map((i, position) => ({
          ingredient_id: i.ingredient_id,
          raw_text: i.raw_text ?? "",
          quantity: i.quantity,
          unit: i.unit,
          preparation: i.preparation,
          section: i.section,
          optional: i.optional,
          position,
        })),
        steps: applied.steps.map((s, position) => ({
          position,
          instruction: s.instruction,
          duration_seconds: s.duration_seconds,
          timer_kind: s.timer_kind,
          tip: s.tip,
          ingredient_ids: (s.ingredient_ids ?? []).filter((id) => UUID.test(id)),
        })),
        change_note: autoChangeNote(lines),
        origin: "cooking_session",
      });
      if (!saved.ok)
        return { ok: false, error: "No se pudieron guardar los cambios en la receta." };
      savedVersion = saved.data.current_version;
    }
  }

  const { error } = await supabase
    .from("cooking_sessions")
    .update({
      finished_at: new Date().toISOString(),
      rating: input.rating ?? null,
      note: input.note || null,
      photo_url: input.photoUrl ?? null,
      pending_edits: input.edits,
    })
    .eq("id", session.id);
  if (error) return { ok: false, error: "No se pudo terminar la sesión." };

  if (input.useAsCover && input.photoUrl && !recipe.image_url) {
    await supabase
      .from("recipes")
      .update({ image_url: input.photoUrl })
      .eq("id", recipe.id)
      .is("image_url", null);
  }

  revalidatePath(`/g/${recipe.group_id}/recetas/${recipe.id}`);
  revalidatePath(`/g/${recipe.group_id}/recetas`);
  void logEvent(user.id, { kind: "cooking_finished", meta: { savedVersion } });
  return { ok: true, data: { savedVersion } };
}

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/** Sube la foto del plato terminado (bucket de imágenes del grupo). */
export async function uploadCookingPhoto(formData: FormData): Promise<Result<{ url: string }>> {
  const groupId = String(formData.get("groupId") ?? "");
  const recipeId = String(formData.get("recipeId") ?? "");
  const file = formData.get("file");
  if (!UUID.test(groupId) || !UUID.test(recipeId) || !(file instanceof File)) {
    return { ok: false, error: "Faltan datos de la foto." };
  }
  if (!file.type.startsWith("image/"))
    return { ok: false, error: "El archivo tiene que ser una imagen." };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, error: "La foto pesa más de 8 MB." };

  await requireUser();
  const supabase = await createClient();
  const ext =
    (file.name.split(".").pop() || "jpg")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 5) || "jpg";
  const path = `${groupId}/${recipeId}/cooked-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("recipe-images")
    .upload(path, file, { contentType: file.type });
  if (error) return { ok: false, error: "No se pudo subir la foto." };
  return {
    ok: true,
    data: { url: supabase.storage.from("recipe-images").getPublicUrl(path).data.publicUrl },
  };
}
