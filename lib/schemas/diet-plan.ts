import { z } from "zod";

const slot = z.enum(["breakfast", "lunch", "merienda", "dinner", "snack"]);

export const componentSchema = z.object({
  /** proteina, verdura, carbohidrato, lacteo, fruta, grasa… */
  group: z.string().trim().min(1).max(40),
  portion: z.string().trim().max(60).optional(),
  allowed: z.boolean().optional(),
});

export const mealSchema = z.object({
  slot,
  /** 0 = domingo … 6 = sábado; vacío o ausente = todos los días. */
  days: z.array(z.number().int().min(0).max(6)).nullish(),
  formula: z.string().trim().max(300),
  components: z.array(componentSchema).default([]),
  options: z.array(z.string().trim().max(300)).default([]),
});

export const ruleSchema = z.object({
  text: z.string().trim().min(1).max(300),
  kind: z.string().trim().max(40).optional(),
});

export const allowancesSchema = z.object({
  per_week: z.number().int().min(0).max(21).default(0),
  definition: z.string().trim().max(300).default(""),
});

export const dietPlanDraftSchema = z.object({
  title: z.string().trim().max(120).default("Mi plan"),
  summary: z.string().trim().max(600).optional(),
  meals: z.array(mealSchema).max(20).default([]),
  rules: z.array(ruleSchema).max(30).default([]),
  allowances: allowancesSchema.default({ per_week: 0, definition: "" }),
  /** Restricciones para el perfil (F5): se proponen ahí, no se aplican solas. */
  restrictions: z.array(z.string().trim().max(200)).max(30).default([]),
  starts_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
  ends_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
  next_checkup: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
  open_questions: z.array(z.string().trim().max(300)).max(10).default([]),
});

export type DietPlanDraft = z.infer<typeof dietPlanDraftSchema>;
export type DietMeal = z.infer<typeof mealSchema>;
