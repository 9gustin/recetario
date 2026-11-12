import { z } from "zod";

export const RECIPES_PAGE_SIZE = 24;

export const recipeSearchSchema = z.object({
  groupId: z.string().uuid(),
  q: z.string().trim().max(100).optional(),
  favoriteOnly: z.boolean().optional(),
  maxMinutes: z.number().int().positive().max(1440).optional(),
  tag: z.string().trim().min(1).max(40).optional(),
  ingredientId: z.string().uuid().optional(),
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(48).default(RECIPES_PAGE_SIZE),
});

export type RecipeSearchInput = z.input<typeof recipeSearchSchema>;

export const ingredientSearchSchema = z.object({
  q: z.string().trim().min(2).max(60),
});
