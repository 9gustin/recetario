import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createAnonClient } from "@/lib/supabase/anon";

export const PAGE_SIZE = 24;

export type PublicCard = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  image_url: string | null;
  total_minutes: number | null;
  servings: number;
  tags: string[];
  is_catalog: boolean;
};

export type SearchParams = {
  q?: string;
  maxMinutes?: number;
  tag?: string;
  source?: "all" | "catalog" | "community";
  page?: number;
};

/** Búsqueda pública: solo texto y filtros, sin IA. Primero lo de la comunidad y después el catálogo. */
export async function searchPublic(
  p: SearchParams,
): Promise<{ cards: PublicCard[]; total: number }> {
  const page = Math.max(1, p.page ?? 1);
  const { data } = await createAnonClient().rpc("search_public_recipes", {
    p_q: p.q?.trim() || undefined,
    p_max_minutes: p.maxMinutes,
    p_tag: p.tag,
    p_catalog: p.source ?? "all",
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });
  const rows = data ?? [];
  return {
    cards: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      description: r.description,
      image_url: r.image_url,
      total_minutes: r.total_minutes,
      servings: Number(r.servings),
      tags: r.tags ?? [],
      is_catalog: r.is_catalog,
    })),
    total: Number(rows[0]?.total_count ?? 0),
  };
}

const publishedRecipeSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  image_url: z.string().nullable(),
  servings: z.coerce.number(),
  prep_minutes: z.number().nullable(),
  cook_minutes: z.number().nullable(),
  total_minutes: z.number().nullable(),
  difficulty: z.string().nullable(),
  tags: z.array(z.string()),
  is_catalog: z.boolean(),
  storage_info: z
    .object({
      fridge_days: z.number().optional(),
      freezer_days: z.number().nullable().optional(),
      reheat: z.string().optional(),
      tip: z.string().nullable().optional(),
    })
    .nullable(),
  ingredients: z.array(
    z.object({
      raw_text: z.string().nullable(),
      quantity: z.coerce.number().nullable(),
      unit: z.string().nullable(),
      preparation: z.string().nullable(),
      section: z.string().nullable(),
      optional: z.boolean(),
      position: z.number(),
    }),
  ),
  steps: z.array(
    z.object({
      position: z.number(),
      instruction: z.string(),
      duration_seconds: z.number().nullable(),
      timer_kind: z.string().nullable(),
      tip: z.string().nullable(),
    }),
  ),
});
export type PublishedRecipe = z.infer<typeof publishedRecipeSchema>;

export const getPublishedRecipe = cache(async (slug: string): Promise<PublishedRecipe | null> => {
  if (!/^[a-z0-9-]{3,140}$/.test(slug)) return null;
  const { data } = await createAnonClient().rpc("get_published_recipe", { p_slug: slug });
  const parsed = publishedRecipeSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
});

const collectionSchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  recipes: z.array(
    z.object({
      slug: z.string(),
      title: z.string(),
      description: z.string().nullable(),
      image_url: z.string().nullable(),
      total_minutes: z.number().nullable(),
      tags: z.array(z.string()),
    }),
  ),
});
export type PublicCollection = z.infer<typeof collectionSchema>;

export const getPublicCollection = cache(async (slug: string): Promise<PublicCollection | null> => {
  if (!/^[a-z0-9-]{3,140}$/.test(slug)) return null;
  const { data } = await createAnonClient().rpc("get_public_collection", { p_slug: slug });
  const parsed = collectionSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
});

const planSchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  entries: z.array(
    z.object({
      day: z.number(),
      slot: z.string(),
      free_text: z.string().nullable(),
      recipe: z
        .object({
          slug: z.string(),
          title: z.string(),
          image_url: z.string().nullable(),
          total_minutes: z.number().nullable(),
        })
        .nullable(),
      recipe_title: z.string().nullable(),
    }),
  ),
});
export type PublicPlan = z.infer<typeof planSchema>;

export const getPublicPlan = cache(async (slug: string): Promise<PublicPlan | null> => {
  if (!/^[a-z0-9-]{3,140}$/.test(slug)) return null;
  const { data } = await createAnonClient().rpc("get_public_plan", { p_slug: slug });
  const parsed = planSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
});

export async function listPublicSlugs() {
  const { data } = await createAnonClient().rpc("list_public_slugs");
  return data ?? [];
}
