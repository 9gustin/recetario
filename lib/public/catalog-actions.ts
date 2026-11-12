"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getGroupDiets } from "@/lib/recipes/compatibility";
import { createClient } from "@/lib/supabase/server";
import { searchCatalog } from "./catalog";

export type CatalogCard = {
  id: string;
  slug: string;
  title: string;
  image_url: string | null;
  total_minutes: number | null;
};

/** Recetas del catálogo para sugerir dentro de la app (sin IA; las prohibidas para el grupo no aparecen). */
export async function searchCatalogCards(
  raw: unknown,
): Promise<{ ok: true; data: CatalogCard[] } | { ok: false; error: string }> {
  const parsed = z
    .object({
      groupId: z.string().uuid(),
      q: z.string().max(100).optional(),
      maxMinutes: z.number().int().positive().optional(),
    })
    .safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const diets = await getGroupDiets(parsed.data.groupId);
  const hits = await searchCatalog(supabase, {
    q: parsed.data.q,
    maxMinutes: parsed.data.maxMinutes,
    limit: 6,
    diets,
  });
  return {
    ok: true,
    data: hits.map((h) => ({
      id: h.id,
      slug: h.slug,
      title: h.title,
      image_url: h.image_url,
      total_minutes: h.total_minutes,
    })),
  };
}
