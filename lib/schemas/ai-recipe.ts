import { z } from "zod";
import { normalizeUnit } from "@/lib/domain/units";
import type { RecipeDraft } from "./recipe";

/** Lo que le pedimos a la IA cuando estructura una receta (todo explícito, sin opcionales). */
export const aiRecipeOutputSchema = z.object({
  is_recipe: z.boolean().describe("false si el contenido no contiene una receta de cocina"),
  title: z.string().max(120),
  description: z.string().max(500).nullable(),
  servings: z.number().positive().nullable(),
  prep_minutes: z.number().int().positive().nullable(),
  cook_minutes: z.number().int().positive().nullable(),
  total_minutes: z.number().int().positive().nullable(),
  difficulty: z.enum(["facil", "media", "dificil"]).nullable(),
  tags: z.array(z.string().max(40)).max(8),
  ingredients: z
    .array(
      z.object({
        raw_text: z
          .string()
          .max(200)
          .describe("El ingrediente como se lee en la receta, ej. '2 cucharadas de aceite'"),
        name_canonical: z
          .string()
          .max(120)
          .describe("Solo el nombre, en singular y sin cantidad: 'aceite de oliva'"),
        quantity: z.number().nullable(),
        unit: z.string().max(20).nullable(),
        preparation: z.string().max(200).nullable(),
        optional: z.boolean(),
        section: z.string().max(80).nullable(),
      }),
    )
    .max(80),
  steps: z
    .array(
      z.object({
        instruction: z.string().max(1000),
        duration_seconds: z.number().int().positive().nullable(),
        timer_kind: z.enum(["active", "passive"]).nullable(),
        tip: z.string().max(500).nullable(),
      }),
    )
    .max(60),
});

export type AiRecipeOutput = z.infer<typeof aiRecipeOutputSchema>;

/** Para recetas que ya vienen estructuradas (JSON-LD): la IA solo estima tiempos y tipo de cada paso. */
export const stepTimingSchema = z.object({
  steps: z.array(
    z.object({
      duration_seconds: z.number().int().positive().nullable(),
      timer_kind: z.enum(["active", "passive"]).nullable(),
      tip: z.string().max(500).nullable(),
    }),
  ),
});

/** Pasa la salida de la IA al borrador que usa el formulario (unidades normalizadas al vocabulario de la app). */
export function aiRecipeToDraft(out: AiRecipeOutput, sourceUrl?: string | null): RecipeDraft {
  return {
    title: out.title.trim() || undefined,
    description: out.description ?? undefined,
    source_url: sourceUrl ?? null,
    servings: out.servings ?? undefined,
    prep_minutes: out.prep_minutes,
    cook_minutes: out.cook_minutes,
    total_minutes: out.total_minutes,
    difficulty: out.difficulty ?? undefined,
    tags: out.tags.map((t) => t.trim()).filter(Boolean),
    ingredients: out.ingredients.map((i, position) => ({
      raw_text: i.raw_text,
      name_canonical: i.name_canonical,
      quantity: i.quantity,
      unit: i.unit ? (normalizeUnit(i.unit) ?? i.unit) : null,
      preparation: i.preparation,
      section: i.section,
      optional: i.optional,
      position,
      ingredient_id: null,
    })),
    steps: out.steps.map((s, position) => ({
      position,
      instruction: s.instruction,
      duration_seconds: s.duration_seconds,
      timer_kind: s.timer_kind,
      tip: s.tip,
      ingredient_ids: [],
    })),
  };
}
