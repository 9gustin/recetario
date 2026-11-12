import { z } from "zod";

export const cookingEditSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("edit_text"),
    step: z.number().int().min(0),
    text: z.string().trim().min(1).max(2000),
  }),
  z.object({
    op: z.literal("set_duration"),
    step: z.number().int().min(0),
    seconds: z.number().int().positive().max(86_400).nullable(),
  }),
  z.object({
    op: z.literal("set_ingredient_qty"),
    ingredient: z.number().int().min(0),
    quantity: z.number().positive().max(1_000_000),
  }),
  z.object({
    op: z.literal("add_step_after"),
    step: z.number().int().min(-1),
    text: z.string().trim().min(1).max(2000),
    seconds: z.number().int().positive().max(86_400).nullable(),
  }),
  z.object({ op: z.literal("delete_step"), step: z.number().int().min(0) }),
]);

export const cookingEditsSchema = z.array(cookingEditSchema).max(200);
