import { describe, expect, it } from "vitest";
import type { MemberDiet } from "./compatibility";
import { isPerishableLate, leftoversExpired } from "./perishability";
import { daysBetween } from "./week";
import {
  validatePlan,
  type PlanIngredient,
  type PlanRecipe,
  type ValidateEntry,
} from "./validate-plan";

const ing = (
  name: string,
  families: string[] = [],
  extra: Partial<PlanIngredient> = {},
): PlanIngredient => ({
  ingredientId: name,
  name,
  families,
  optional: false,
  ...extra,
});
const recipe = (
  id: string,
  ingredients: PlanIngredient[],
  extra: Partial<PlanRecipe> = {},
): PlanRecipe => ({
  id,
  title: `Receta ${id}`,
  ingredients,
  ...extra,
});
const entry = (
  id: string,
  date: string,
  r: PlanRecipe | null,
  extra: Partial<ValidateEntry> = {},
): ValidateEntry => ({
  id,
  date,
  slot: "dinner",
  recipe: r,
  dinerIds: [],
  ...extra,
});

const ana: MemberDiet = {
  userId: "ana",
  displayName: "Ana",
  restrictions: [{ target: "cebolla", type: "ingredient", severity: "forbidden" }],
};
const beto: MemberDiet = { userId: "beto", displayName: "Beto", restrictions: [] };

describe("validatePlan", () => {
  it("plan vacío o sin problemas no devuelve nada", () => {
    expect(validatePlan({ entries: [], diets: [] })).toEqual({ errors: [], warnings: [] });
    const r = recipe("1", [ing("papa")]);
    expect(validatePlan({ entries: [entry("e1", "2026-11-09", r)], diets: [ana] })).toEqual({
      errors: [],
      warnings: [],
    });
  });

  it("FORBIDDEN_INGREDIENT: error con la persona y el ingrediente", () => {
    const r = recipe("1", [ing("cebolla", ["allium"])]);
    const { errors } = validatePlan({
      entries: [entry("e1", "2026-11-09", r)],
      diets: [ana, beto],
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ entryId: "e1", code: "FORBIDDEN_INGREDIENT" });
    expect(errors[0]?.message).toContain("Ana");
    expect(errors[0]?.message).toContain("cebolla");
  });

  it("solo valida contra los comensales de esa entrada", () => {
    const r = recipe("1", [ing("cebolla", ["allium"])]);
    const soloBeto = entry("e1", "2026-11-09", r, { dinerIds: ["beto"] });
    expect(validatePlan({ entries: [soloBeto], diets: [ana, beto] }).errors).toEqual([]);
  });

  it("ignora entradas de texto libre", () => {
    expect(
      validatePlan({ entries: [entry("e1", "2026-11-09", null)], diets: [ana] }).errors,
    ).toEqual([]);
  });

  it("REPEATED_RECIPE: avisa en la segunda, pero no con sobras", () => {
    const r = recipe("1", [ing("arroz")]);
    const repeated = validatePlan({
      entries: [entry("a", "2026-11-09", r), entry("b", "2026-11-10", r)],
      diets: [],
    });
    expect(repeated.warnings).toHaveLength(1);
    expect(repeated.warnings[0]).toMatchObject({ entryId: "b", code: "REPEATED_RECIPE" });
    const leftover = validatePlan({
      entries: [
        entry("a", "2026-11-09", r),
        entry("b", "2026-11-10", r, { leftoversOfEntryId: "a" }),
      ],
      diets: [],
    });
    expect(leftover.warnings).toEqual([]);
  });

  it("PROTEIN_MONOTONY: más de 3 veces la misma familia", () => {
    const mk = (n: number) =>
      entry(`e${n}`, `2026-11-0${n + 1}`, recipe(`r${n}`, [ing("pollo", ["ave"])]));
    expect(validatePlan({ entries: [mk(1), mk(2), mk(3)], diets: [] }).warnings).toEqual([]);
    const { warnings } = validatePlan({ entries: [mk(1), mk(2), mk(3), mk(4)], diets: [] });
    expect(warnings.map((w) => w.code)).toEqual(["PROTEIN_MONOTONY"]);
    expect(warnings[0]?.entryId).toBe("e4");
  });

  it("PROTEIN_MONOTONY ignora ingredientes opcionales y sobras", () => {
    const opt = recipe("o", [ing("jamón", ["cerdo"], { optional: true })]);
    const entries = [1, 2, 3, 4].map((n) =>
      entry(`e${n}`, `2026-11-0${n}`, { ...opt, id: `o${n}` }),
    );
    expect(validatePlan({ entries, diets: [] }).warnings).toEqual([]);
  });

  it("PERISHABLE_LATE: vida útil menor a los días desde la compra", () => {
    const r = recipe("1", [ing("pescado", ["pescado"], { shelfLifeFridgeDays: 2 })]);
    const early = entry("e1", "2026-11-10", r);
    const late = entry(
      "e2",
      "2026-11-13",
      recipe("2", [ing("pescado", [], { shelfLifeFridgeDays: 2 })]),
    );
    const { warnings } = validatePlan({
      entries: [early, late],
      diets: [],
      purchaseDate: "2026-11-09",
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ entryId: "e2", code: "PERISHABLE_LATE" });
    expect(warnings[0]?.message).toContain("pescado");
  });

  it("PERISHABLE_LATE usa la fecha de cocción si existe y asume la compra al primer día", () => {
    const r = recipe("1", [ing("espinaca", [], { shelfLifeFridgeDays: 3 })]);
    const e = entry("e1", "2026-11-14", r, { cookDate: "2026-11-10" });
    const first = entry("e0", "2026-11-09", null);
    expect(validatePlan({ entries: [first, e], diets: [] }).warnings).toEqual([]);
  });

  it("LEFTOVERS_EXPIRED: sobras después de más de 3 días", () => {
    const r = recipe("1", [ing("guiso")]);
    const src = entry("a", "2026-11-09", r);
    const ok = entry("b", "2026-11-12", r, { leftoversOfEntryId: "a" });
    const bad = entry("c", "2026-11-13", r, { leftoversOfEntryId: "a" });
    expect(validatePlan({ entries: [src, ok], diets: [] }).warnings).toEqual([]);
    const { warnings } = validatePlan({ entries: [src, bad], diets: [] });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ entryId: "c", code: "LEFTOVERS_EXPIRED" });
  });

  it("sobras de una entrada inexistente se ignoran", () => {
    const r = recipe("1", [ing("x")]);
    expect(
      validatePlan({
        entries: [entry("b", "2026-11-13", r, { leftoversOfEntryId: "nada" })],
        diets: [],
      }).warnings,
    ).toEqual([]);
  });

  it("LIMIT_EXCEEDED: solo con datos completos del día", () => {
    const a = entry("a", "2026-11-09", recipe("1", [], { carbsPerServingG: 80 }));
    const b = entry("b", "2026-11-09", recipe("2", [], { carbsPerServingG: 90 }));
    const { warnings } = validatePlan({ entries: [a, b], diets: [], carbsPerDayLimitG: 150 });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ entryId: "b", code: "LIMIT_EXCEEDED" });
    expect(validatePlan({ entries: [a, b], diets: [], carbsPerDayLimitG: 200 }).warnings).toEqual(
      [],
    );
    const sinDatos = entry("c", "2026-11-09", recipe("3", [], { carbsPerServingG: null }));
    expect(
      validatePlan({ entries: [a, sinDatos], diets: [], carbsPerDayLimitG: 10 }).warnings,
    ).toEqual([]);
    expect(
      validatePlan({ entries: [entry("d", "2026-11-09", null)], diets: [], carbsPerDayLimitG: 10 })
        .warnings,
    ).toEqual([]);
  });
});

describe("perishability", () => {
  it("isPerishableLate", () => {
    expect(isPerishableLate(null, 10)).toBe(false);
    expect(isPerishableLate(undefined, 10)).toBe(false);
    expect(isPerishableLate(3, 3)).toBe(false);
    expect(isPerishableLate(3, 4)).toBe(true);
  });
  it("leftoversExpired", () => {
    expect(leftoversExpired("2026-11-09", "2026-11-12", daysBetween)).toBe(false);
    expect(leftoversExpired("2026-11-09", "2026-11-13", daysBetween)).toBe(true);
  });
});
