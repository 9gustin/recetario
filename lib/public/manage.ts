"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logEvent } from "@/lib/activity/log";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();
type Res<T = null> = { ok: true; data: T } | { ok: false; error: string };

/** Hacer pública (o privada) una receta. Devuelve el slug de su página pública. */
export async function setRecipePublic(raw: unknown): Promise<Res<{ slug: string | null }>> {
  const parsed = z.object({ recipeId: uuid, groupId: uuid, isPublic: z.boolean() }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_recipe_visibility", {
    p_recipe_id: parsed.data.recipeId,
    p_public: parsed.data.isPublic,
  });
  if (error)
    return {
      ok: false,
      error: error.message.includes("confirmadas")
        ? "Confirmá la receta antes de publicarla."
        : "No se pudo cambiar.",
    };
  if (parsed.data.isPublic)
    void logEvent(user.id, { kind: "recipe_published", groupId: parsed.data.groupId });
  revalidatePath(`/g/${parsed.data.groupId}/recetas/${parsed.data.recipeId}`);
  return { ok: true, data: { slug: parsed.data.isPublic ? data : null } };
}

export async function createCollection(raw: unknown): Promise<Res<{ id: string }>> {
  const parsed = z
    .object({
      groupId: uuid,
      title: z.string().trim().min(1).max(120),
      description: z.string().trim().max(600).optional(),
    })
    .safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Poné un nombre para la colección." };
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipe_collections")
    .insert({
      group_id: parsed.data.groupId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "No se pudo crear la colección." };
  revalidatePath(`/g/${parsed.data.groupId}/recetas/colecciones`);
  return { ok: true, data: { id: data.id } };
}

export async function addToCollection(raw: unknown): Promise<Res> {
  const parsed = z.object({ collectionId: uuid, recipeId: uuid, groupId: uuid }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { count } = await supabase
    .from("recipe_collection_items")
    .select("recipe_id", { count: "exact", head: true })
    .eq("collection_id", parsed.data.collectionId);
  const { error } = await supabase.from("recipe_collection_items").upsert(
    {
      collection_id: parsed.data.collectionId,
      recipe_id: parsed.data.recipeId,
      position: count ?? 0,
    },
    { onConflict: "collection_id,recipe_id" },
  );
  if (error) return { ok: false, error: "No se pudo agregar." };
  // Si la colección ya es pública, la receta también tiene que serlo.
  const { data: col } = await supabase
    .from("recipe_collections")
    .select("visibility")
    .eq("id", parsed.data.collectionId)
    .maybeSingle();
  if (col?.visibility === "public")
    await supabase.rpc("set_collection_visibility", {
      p_collection_id: parsed.data.collectionId,
      p_public: true,
    });
  revalidatePath(`/g/${parsed.data.groupId}/recetas/colecciones/${parsed.data.collectionId}`);
  return { ok: true, data: null };
}

export async function removeFromCollection(raw: unknown): Promise<Res> {
  const parsed = z.object({ collectionId: uuid, recipeId: uuid, groupId: uuid }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("recipe_collection_items")
    .delete()
    .eq("collection_id", parsed.data.collectionId)
    .eq("recipe_id", parsed.data.recipeId);
  if (error) return { ok: false, error: "No se pudo quitar." };
  revalidatePath(`/g/${parsed.data.groupId}/recetas/colecciones/${parsed.data.collectionId}`);
  return { ok: true, data: null };
}

export async function setCollectionPublic(raw: unknown): Promise<Res<{ slug: string | null }>> {
  const parsed = z
    .object({ collectionId: uuid, groupId: uuid, isPublic: z.boolean() })
    .safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_collection_visibility", {
    p_collection_id: parsed.data.collectionId,
    p_public: parsed.data.isPublic,
  });
  if (error) return { ok: false, error: "No se pudo cambiar." };
  revalidatePath(`/g/${parsed.data.groupId}/recetas/colecciones/${parsed.data.collectionId}`);
  return { ok: true, data: { slug: parsed.data.isPublic ? data : null } };
}

export async function publishPlanAction(raw: unknown): Promise<Res<{ slug: string }>> {
  const parsed = z
    .object({
      planId: uuid,
      groupId: uuid,
      title: z.string().trim().min(1).max(120),
      description: z.string().trim().max(600).optional(),
    })
    .safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Poné un título para el plan." };
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_plan", {
    p_plan_id: parsed.data.planId,
    p_title: parsed.data.title,
    p_description: parsed.data.description,
  });
  if (error || !data) return { ok: false, error: "No se pudo publicar el plan." };
  revalidatePath(`/g/${parsed.data.groupId}/plan`);
  return { ok: true, data: { slug: data } };
}

export async function unpublishPlanAction(raw: unknown): Promise<Res> {
  const parsed = z.object({ planId: uuid, groupId: uuid }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("unpublish_plan", { p_plan_id: parsed.data.planId });
  if (error) return { ok: false, error: "No se pudo dejar de compartir." };
  revalidatePath(`/g/${parsed.data.groupId}/plan`);
  return { ok: true, data: null };
}
