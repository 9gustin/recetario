import { z } from "zod";
import { foodProfileDataSchema } from "./food-profile";

export const ingestRequestSchema = z
  .object({
    text: z.string().trim().max(10_000).optional(),
    transcript: z.string().trim().max(10_000).optional(),
    /** Rutas en el bucket `profile-inputs` (`<user_id>/<archivo>`). */
    filePaths: z.array(z.string().max(200)).max(3).optional(),
    answers: z
      .array(
        z.object({ question: z.string().max(300), answer: z.string().trim().min(1).max(1000) }),
      )
      .max(8)
      .optional(),
  })
  .refine((v) => v.text || v.transcript || v.filePaths?.length || v.answers?.length, {
    message: "Falta contar algo, subir un archivo o responder una pregunta.",
  });

export type IngestRequest = z.infer<typeof ingestRequestSchema>;

export const applyRequestSchema = z.object({
  draftId: z.string().uuid(),
  edits: z
    .object({
      profile: foodProfileDataSchema.partial().optional(),
      summary: z.string().trim().max(1500).optional(),
    })
    .optional(),
});
