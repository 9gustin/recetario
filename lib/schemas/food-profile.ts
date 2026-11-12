import { z } from "zod";

export const restrictionSchema = z.object({
  /** Ingrediente, familia o categoría ("cebolla", "allium", "harinas refinadas"). */
  target: z.string().trim().min(1).max(80),
  type: z.enum(["ingredient", "family", "category"]),
  severity: z.enum(["forbidden", "limit"]),
  reason: z.string().trim().max(200).optional(),
  /** Para `limit`: en qué se limita ("evitar en la cena", "máx. 2 veces por semana"). */
  limit: z.string().trim().max(200).optional(),
  /** Miembros de la familia que la persona confirmó que también están prohibidos. */
  includes: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
});

export const goalSchema = z.object({
  kind: z.string().trim().min(1).max(60),
  detail: z.string().trim().max(300).optional(),
  numeric: z.record(z.string(), z.number()).optional(),
});

const MEALS = ["breakfast", "lunch", "snack", "dinner"] as const;
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export const scheduleSchema = z.object({
  weekday_cook_minutes_max: z.number().int().positive().max(600).optional(),
  weekend_cook_minutes_max: z.number().int().positive().max(600).optional(),
  meals_at_home: z.partialRecord(z.enum(DAYS), z.array(z.enum(MEALS))).optional(),
});

const shortList = z.array(z.string().trim().min(1).max(80)).max(40);

/** Perfil estructurado (SPEC §6.2). */
export const foodProfileDataSchema = z.object({
  restrictions: z.array(restrictionSchema).max(60).default([]),
  goals: z.array(goalSchema).max(20).default([]),
  likes: shortList.default([]),
  dislikes: shortList.default([]),
  cuisines: shortList.default([]),
  schedule: scheduleSchema.default({}),
  equipment: shortList.default([]),
  skill: z.enum(["principiante", "intermedio", "avanzado"]).nullable().default(null),
  /** Vigencia de una dieta temporal (YYYY-MM-DD). */
  valid_until: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
});

export type FoodProfileData = z.infer<typeof foodProfileDataSchema>;
export type Restriction = z.infer<typeof restrictionSchema>;
export type Goal = z.infer<typeof goalSchema>;

export const profileChangeSchema = z.object({
  op: z.enum(["add", "change", "remove"]),
  path: z.string().max(60),
  text: z.string().max(300),
});

/** Lo que devuelve la IA al procesar nuevas entradas: perfil completo, resumen, cambios y dudas. */
export const foodProfileProposalSchema = z.object({
  profile: foodProfileDataSchema,
  summary: z.string().max(1500),
  changes: z.array(profileChangeSchema).max(40),
  open_questions: z.array(z.string().max(300)).max(8),
});

export type FoodProfileProposal = z.infer<typeof foodProfileProposalSchema>;
export type ProfileChange = z.infer<typeof profileChangeSchema>;

export function emptyProfile(): FoodProfileData {
  return foodProfileDataSchema.parse({});
}

const restrictionKey = (r: Restriction) => `${r.type}:${r.target.toLowerCase().trim()}`;

/**
 * Aplica ediciones manuales sobre un perfil: las listas que vienen en `patch` reemplazan a las
 * anteriores (las restricciones se deduplican por tipo + objetivo; si hay repetidas gana la más
 * estricta) y lo que no viene queda como estaba.
 */
export function mergeProfiles(
  base: FoodProfileData,
  patch: Partial<FoodProfileData>,
): FoodProfileData {
  const merged: FoodProfileData = {
    ...base,
    ...patch,
    schedule: { ...base.schedule, ...patch.schedule },
  };
  const byKey = new Map<string, Restriction>();
  for (const r of merged.restrictions) {
    const key = restrictionKey(r);
    const prev = byKey.get(key);
    if (!prev || (prev.severity === "limit" && r.severity === "forbidden")) byKey.set(key, r);
  }
  return foodProfileDataSchema.parse({ ...merged, restrictions: [...byKey.values()] });
}
