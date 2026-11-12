import { z } from "zod";

export const assistantChatSchema = z.object({
  groupId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(2000),
  /** Recetas citadas con @. */
  mentions: z.array(z.string().uuid()).max(5).default([]),
  context: z
    .object({
      origin: z.enum(["home", "recipe", "cooking"]),
      /** Receta abierta (origin recipe) o que se está cocinando (origin cooking). */
      recipeId: z.string().uuid().optional(),
      /** Modo cocinar: pantalla actual (0 = mise en place, 1..n = pasos). */
      step: z.number().int().min(0).max(500).optional(),
      servings: z.number().positive().max(1000).optional(),
      timers: z
        .array(
          z.object({
            label: z.string().max(60),
            remaining_seconds: z.number().int().min(0).max(86_400),
          }),
        )
        .max(10)
        .optional(),
    })
    .default({ origin: "home" }),
});

export type AssistantChatRequest = z.infer<typeof assistantChatSchema>;
