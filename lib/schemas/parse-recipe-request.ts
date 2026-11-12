import { z } from "zod";

export const parseRecipeRequestSchema = z.object({
  groupId: z.string().uuid(),
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("text"), text: z.string().max(20_000) }),
    z.object({ kind: z.literal("url"), url: z.string().url().max(2000) }),
    z.object({ kind: z.literal("image"), paths: z.array(z.string().max(300)).min(1).max(4) }),
    z.object({ kind: z.literal("voice"), transcript: z.string().max(20_000) }),
  ]),
});

export type ParseRecipeRequest = z.infer<typeof parseRecipeRequestSchema>;
