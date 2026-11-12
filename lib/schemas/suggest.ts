import { z } from "zod";

export const suggestFilters = z.object({
  quick: z.boolean().default(false),
  noOven: z.boolean().default(false),
  light: z.boolean().default(false),
});
export type SuggestFilters = z.infer<typeof suggestFilters>;

export const suggestRequestSchema = z.object({
  groupId: z.string().uuid(),
  mode: z.enum(["have", "ideas"]).default("have"),
  have: z.array(z.string().trim().min(1).max(60)).max(40).default([]),
  craving: z.string().trim().max(200).optional(),
  filters: suggestFilters.default({ quick: false, noOven: false, light: false }),
  /** Pestaña de las ideas: del recetario o recetas nuevas. */
  tab: z.enum(["library", "new"]).default("library"),
  /** Ideas ya mostradas, para "otras 3 ideas". */
  exclude: z.array(z.string().uuid()).max(60).default([]),
});
export type SuggestRequest = z.infer<typeof suggestRequestSchema>;

/** Respuesta del modelo: una línea por receta, en el orden en que conviene mostrarlas. */
export const rankedSchema = z.object({
  items: z.array(z.object({ id: z.string(), line: z.string().max(200) })).max(10),
});

/** Recetas nuevas que inventa el modelo cuando el recetario no alcanza. */
export const newRecipesSchema = z.object({
  recipes: z
    .array(
      z.object({
        title: z.string().max(120),
        total_minutes: z.number().int().positive().max(240),
        ingredients: z.array(z.string().max(200)).min(1).max(30),
        steps: z.array(z.string().max(1000)).min(1).max(20),
        line: z.string().max(200),
      }),
    )
    .max(3),
});

export type SuggestCard = {
  recipeId: string;
  title: string;
  imageUrl: string | null;
  totalMinutes: number | null;
  line: string;
  label: string;
  missing: string[];
  isNew: boolean;
  /** Motivo de la idea (modo ideas). */
  reason?: string;
};
