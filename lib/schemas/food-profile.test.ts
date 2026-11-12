import { describe, expect, it } from "vitest";
import {
  emptyProfile,
  foodProfileDataSchema,
  foodProfileProposalSchema,
  mergeProfiles,
} from "./food-profile";

// Ejemplo de SPEC §6.2.
const EXAMPLE = {
  restrictions: [
    {
      target: "cebolla",
      type: "ingredient",
      severity: "forbidden",
      reason: "tratamiento",
      includes: ["cebolla de verdeo", "echalote"],
    },
    {
      target: "harinas refinadas",
      type: "category",
      severity: "limit",
      limit: "evitar en la cena",
    },
  ],
  goals: [
    { kind: "low_carb", detail: "≤ 50 g carbohidratos/día", numeric: { carbs_g_per_day_max: 50 } },
  ],
  likes: ["pollo", "pescado blanco", "zapallitos"],
  dislikes: ["hígado"],
  cuisines: ["casera argentina", "asiática"],
  schedule: {
    weekday_cook_minutes_max: 30,
    meals_at_home: { mon: ["dinner"], tue: ["lunch", "dinner"] },
  },
  equipment: ["horno", "airfryer", "freezer"],
  skill: "intermedio",
  valid_until: null,
};

describe("foodProfileDataSchema", () => {
  it("acepta el perfil de ejemplo de la spec", () => {
    const parsed = foodProfileDataSchema.parse(EXAMPLE);
    expect(parsed.restrictions).toHaveLength(2);
    expect(parsed.schedule.meals_at_home?.tue).toEqual(["lunch", "dinner"]);
  });

  it("completa los valores por defecto de un perfil vacío", () => {
    expect(emptyProfile()).toEqual({
      restrictions: [],
      goals: [],
      likes: [],
      dislikes: [],
      cuisines: [],
      schedule: {},
      equipment: [],
      skill: null,
      valid_until: null,
    });
  });

  it("rechaza severidades, tipos y fechas inválidos", () => {
    expect(
      foodProfileDataSchema.safeParse({
        restrictions: [{ target: "x", type: "ingredient", severity: "prohibido" }],
      }).success,
    ).toBe(false);
    expect(
      foodProfileDataSchema.safeParse({
        restrictions: [{ target: "x", type: "cosa", severity: "forbidden" }],
      }).success,
    ).toBe(false);
    expect(foodProfileDataSchema.safeParse({ valid_until: "marzo" }).success).toBe(false);
    expect(
      foodProfileDataSchema.safeParse({ schedule: { meals_at_home: { lun: ["dinner"] } } }).success,
    ).toBe(false);
  });
});

describe("foodProfileProposalSchema", () => {
  it("acepta perfil + resumen + cambios + preguntas", () => {
    const parsed = foodProfileProposalSchema.parse({
      profile: EXAMPLE,
      summary: "Comés principalmente proteína y verduras.",
      changes: [{ op: "add", path: "restrictions", text: "No come cebolla" }],
      open_questions: ["¿El ajo también está prohibido o solo la cebolla?"],
    });
    expect(parsed.open_questions).toHaveLength(1);
  });
});

describe("mergeProfiles", () => {
  const base = foodProfileDataSchema.parse(EXAMPLE);

  it("reemplaza las listas que vienen y conserva el resto", () => {
    const merged = mergeProfiles(base, { likes: ["salmón"], valid_until: "2027-03-31" });
    expect(merged.likes).toEqual(["salmón"]);
    expect(merged.valid_until).toBe("2027-03-31");
    expect(merged.restrictions).toEqual(base.restrictions);
    expect(merged.equipment).toEqual(base.equipment);
  });

  it("combina el horario sin perder lo que no se tocó", () => {
    const merged = mergeProfiles(base, { schedule: { weekend_cook_minutes_max: 90 } });
    expect(merged.schedule).toMatchObject({
      weekday_cook_minutes_max: 30,
      weekend_cook_minutes_max: 90,
    });
  });

  it("deduplica restricciones por tipo y objetivo, y gana la más estricta", () => {
    const merged = mergeProfiles(base, {
      restrictions: [
        { target: "Maní", type: "ingredient", severity: "limit" },
        { target: "maní", type: "ingredient", severity: "forbidden" },
        { target: "maní", type: "family", severity: "limit" },
      ],
    });
    expect(merged.restrictions).toHaveLength(2);
    expect(merged.restrictions.find((r) => r.type === "ingredient")?.severity).toBe("forbidden");
  });
});
