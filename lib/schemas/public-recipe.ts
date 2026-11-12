import { z } from "zod";

/** Lo que devuelve la RPC `get_public_recipe` (sin IDs internos). */
export const publicRecipeSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  image_url: z.string().nullable(),
  servings: z.coerce.number().positive(),
  prep_minutes: z.number().nullable(),
  cook_minutes: z.number().nullable(),
  total_minutes: z.number().nullable(),
  difficulty: z.string().nullable(),
  tags: z.array(z.string()).default([]),
  shared_by: z.object({ name: z.string().nullable(), avatar_url: z.string().nullable() }),
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

export type PublicRecipe = z.infer<typeof publicRecipeSchema>;

export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
