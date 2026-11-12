import { z } from "zod";
import { aiRecipeOutputSchema } from "./ai-recipe";

/** Receta adaptada por la IA: la receta estructurada + qué cambió y cómo se llama la variante. */
export const adaptedRecipeSchema = aiRecipeOutputSchema.extend({
  changes: z.array(z.string().max(220)).max(12),
  title_suffix: z.string().max(40),
});

export type AdaptedRecipeOutput = z.infer<typeof adaptedRecipeSchema>;

export const adaptRequestSchema = z.object({
  /** Personas para las que se adapta (con perfil en el grupo de la receta). */
  memberIds: z.array(z.string().uuid()).min(1).max(10),
});
