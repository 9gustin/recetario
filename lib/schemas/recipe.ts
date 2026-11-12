import { z } from "zod";

const difficultySchema = z.enum(["facil", "media", "dificil"]);
const sourceTypeSchema = z.enum([
  "manual",
  "text",
  "url",
  "photo",
  "voice",
  "ai_generated",
  "fork",
]);
const timerKindSchema = z.enum(["active", "passive"]);

export const ingredientInputSchema = z.object({
  ingredient_id: z.string().uuid().nullable().optional(),
  raw_text: z.string().trim().max(200),
  quantity: z.number().nullable().optional(),
  unit: z.string().max(20).nullable().optional(),
  preparation: z.string().max(200).nullable().optional(),
  section: z.string().max(80).nullable().optional(),
  optional: z.boolean().default(false),
  position: z.number().int().default(0),
});

export const stepInputSchema = z.object({
  position: z.number().int().default(0),
  instruction: z.string().trim().min(1).max(2000),
  duration_seconds: z.number().int().positive().nullable().optional(),
  timer_kind: timerKindSchema.nullable().optional(),
  tip: z.string().max(500).nullable().optional(),
  ingredient_ids: z.array(z.string().uuid()).default([]),
});

export const recipeInputSchema = z.object({
  id: z.string().uuid().optional(),
  group_id: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  description: z.string().max(2000).nullable().default(null),
  image_url: z.string().nullable().default(null),
  servings: z.number().positive().default(2),
  prep_minutes: z.number().int().positive().nullable().default(null),
  cook_minutes: z.number().int().positive().nullable().default(null),
  total_minutes: z.number().int().positive().nullable().default(null),
  difficulty: difficultySchema.nullable().default(null),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  source_type: sourceTypeSchema.default("manual"),
  source_url: z.string().nullable().default(null),
  ingredients: z.array(ingredientInputSchema).min(1),
  steps: z.array(stepInputSchema).min(1),
  change_note: z.string().max(500).nullable().optional(),
  origin: z.enum(["edit", "cooking_session", "ai_adapt", "restore"]).default("edit"),
});

export type RecipeInput = z.infer<typeof recipeInputSchema>;
export type IngredientInput = z.infer<typeof ingredientInputSchema>;
export type StepInput = z.infer<typeof stepInputSchema>;

/**
 * Borrador de receta (lo usa la IA en la Etapa 5): campos opcionales y
 * `name_canonical` en los ingredientes para vincularlos al catálogo.
 */
export const recipeDraftSchema = z.object({
  title: z.string().trim().max(120).optional(),
  description: z.string().max(2000).optional(),
  image_url: z.string().max(1000).nullable().optional(),
  source_url: z.string().max(1000).nullable().optional(),
  servings: z.number().positive().optional(),
  prep_minutes: z.number().int().positive().nullable().optional(),
  cook_minutes: z.number().int().positive().nullable().optional(),
  total_minutes: z.number().int().positive().nullable().optional(),
  difficulty: difficultySchema.optional(),
  tags: z.array(z.string().trim().max(40)).default([]),
  ingredients: z
    .array(
      ingredientInputSchema.extend({
        name_canonical: z.string().trim().max(120).optional(),
      }),
    )
    .optional(),
  steps: z.array(stepInputSchema).optional(),
});

export type RecipeDraft = z.infer<typeof recipeDraftSchema>;
