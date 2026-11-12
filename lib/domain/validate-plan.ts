/** Validación del plan semanal. Lógica pura: sin DB ni IA. Los mensajes van al modelo y a la UI. */
import { checkRecipe, type MemberDiet, type RecipeIngredientForCheck } from "./compatibility";
import { LEFTOVER_MAX_DAYS, isPerishableLate, leftoversExpired } from "./perishability";
import { mismatchedGroups, rulesFor, type MealRule } from "./meal-rules";
import { slotLabel } from "./meal-slots";
import { daysBetween, dayLabel, dayOfWeek } from "./week";

export const PROTEIN_FAMILIES = [
  "ave",
  "carne_roja",
  "pescado",
  "cerdo",
  "huevo",
  "legumbre",
] as const;
const PROTEIN_MAX_PER_WEEK = 3;

export type PlanIngredient = RecipeIngredientForCheck & {
  /** Días que dura en heladera (catálogo). */
  shelfLifeFridgeDays?: number | null;
};

export type PlanRecipe = {
  id: string;
  title: string;
  ingredients: PlanIngredient[];
  /** Carbohidratos aproximados por porción, si el catálogo tiene datos. */
  carbsPerServingG?: number | null;
};

export type ValidateEntry = {
  id: string;
  date: string;
  slot: string;
  recipe: PlanRecipe | null;
  /** Comensales de esta entrada (vacío = todo el grupo). */
  dinerIds: string[];
  cookDate?: string | null;
  leftoversOfEntryId?: string | null;
};

export type PlanIssueCode =
  | "FORBIDDEN_INGREDIENT"
  | "LIMIT_EXCEEDED"
  | "REPEATED_RECIPE"
  | "PROTEIN_MONOTONY"
  | "PERISHABLE_LATE"
  | "LEFTOVERS_EXPIRED"
  | "MEAL_RULE_MISMATCH";

export type PlanIssue = { entryId: string; code: PlanIssueCode; message: string };

export type ValidatePlanInput = {
  entries: ValidateEntry[];
  diets: MemberDiet[];
  /** Fórmulas por momento del plan vivo de cada persona (solo avisan; no bloquean). */
  mealRules?: MealRule[];
  /** Día previsto de la compra (default: la fecha más temprana del plan). */
  purchaseDate?: string;
  /** Tope diario de carbohidratos (g); solo se evalúa si hay datos de todas las comidas del día. */
  carbsPerDayLimitG?: number;
};

const where = (e: ValidateEntry) => `${slotLabel(e.slot).toLowerCase()} del ${dayLabel(e.date)}`;

export function validatePlan(input: ValidatePlanInput): {
  errors: PlanIssue[];
  warnings: PlanIssue[];
} {
  const errors: PlanIssue[] = [];
  const warnings: PlanIssue[] = [];
  const { entries, diets } = input;
  const byId = new Map(entries.map((e) => [e.id, e]));
  const purchase = input.purchaseDate ?? [...entries.map((e) => e.date)].sort()[0];

  // 1. Restricciones: contra los comensales de CADA entrada.
  for (const e of entries) {
    if (!e.recipe) continue;
    const diners =
      e.dinerIds.length > 0 ? diets.filter((d) => e.dinerIds.includes(d.userId)) : diets;
    for (const d of diners) {
      const res = checkRecipe(e.recipe.ingredients, d.restrictions);
      if (res.status !== "forbidden") continue;
      for (const r of res.reasons.filter((x) => x.severity === "forbidden")) {
        errors.push({
          entryId: e.id,
          code: "FORBIDDEN_INGREDIENT",
          message: `"${e.recipe.title}" (${where(e)}) tiene ${r.ingredient}, y ${d.displayName ?? "una persona"} no puede comerlo (${r.restriction}).`,
        });
      }
    }
  }

  // 2. Recetas repetidas (las sobras no cuentan).
  const seen = new Map<string, ValidateEntry>();
  for (const e of entries) {
    if (!e.recipe || e.leftoversOfEntryId) continue;
    const first = seen.get(e.recipe.id);
    if (first) {
      warnings.push({
        entryId: e.id,
        code: "REPEATED_RECIPE",
        message: `"${e.recipe.title}" se repite (${where(first)} y ${where(e)}). Si cocinás de más, marcá la segunda como sobras.`,
      });
    } else seen.set(e.recipe.id, e);
  }

  // 3. Monotonía de proteína: misma familia más de 3 veces en la semana.
  for (const family of PROTEIN_FAMILIES) {
    const withFamily = entries.filter(
      (e) =>
        e.recipe &&
        !e.leftoversOfEntryId &&
        e.recipe.ingredients.some((i) => !i.optional && i.families.includes(family)),
    );
    if (withFamily.length > PROTEIN_MAX_PER_WEEK) {
      const last = withFamily[withFamily.length - 1]!;
      warnings.push({
        entryId: last.id,
        code: "PROTEIN_MONOTONY",
        message: `Hay ${withFamily.length} comidas con ${family.replace("_", " ")} en la semana. Variá alguna con otra proteína.`,
      });
    }
  }

  // 4. Perecederos: vida útil menor que los días entre la compra y el uso.
  if (purchase) {
    for (const e of entries) {
      if (!e.recipe || e.leftoversOfEntryId) continue;
      const useDate = e.cookDate ?? e.date;
      const days = daysBetween(purchase, useDate);
      for (const i of e.recipe.ingredients) {
        if (isPerishableLate(i.shelfLifeFridgeDays, days)) {
          warnings.push({
            entryId: e.id,
            code: "PERISHABLE_LATE",
            message: `${i.name} dura ${i.shelfLifeFridgeDays} días en la heladera y se usa a los ${days} de la compra (${where(e)}). Movelo antes o compralo a mitad de semana.`,
          });
        }
      }
    }
  }

  // 5. Sobras muy tardías.
  for (const e of entries) {
    if (!e.leftoversOfEntryId) continue;
    const source = byId.get(e.leftoversOfEntryId);
    if (!source) continue;
    const cooked = source.cookDate ?? source.date;
    if (leftoversExpired(cooked, e.date, daysBetween)) {
      warnings.push({
        entryId: e.id,
        code: "LEFTOVERS_EXPIRED",
        message: `Las sobras de ${where(e)} se cocinaron hace más de ${LEFTOVER_MAX_DAYS} días. Pasalas antes o congelalas.`,
      });
    }
  }

  // 7. Fórmulas del plan vivo: la receta no encaja con el momento para algún comensal.
  if (input.mealRules?.length) {
    for (const e of entries) {
      if (!e.recipe) continue;
      const diners =
        e.dinerIds.length > 0 ? e.dinerIds : [...new Set(input.mealRules.map((r) => r.userId))];
      for (const userId of diners) {
        for (const rule of rulesFor(input.mealRules, e.slot, e.date, dayOfWeek, userId)) {
          const bad = mismatchedGroups(rule, e.recipe.ingredients);
          if (bad.length === 0) continue;
          warnings.push({
            entryId: e.id,
            code: "MEAL_RULE_MISMATCH",
            message: `"${e.recipe.title}" (${where(e)}) no encaja con el plan de ${rule.displayName ?? "una persona"} ("${rule.formula}"): tiene ${bad.join(", ")}.`,
          });
        }
      }
    }
  }

  // 6. Tope diario de carbohidratos (solo con datos completos).
  if (input.carbsPerDayLimitG !== undefined) {
    const limit = input.carbsPerDayLimitG;
    const days = new Map<string, ValidateEntry[]>();
    for (const e of entries) days.set(e.date, [...(days.get(e.date) ?? []), e]);
    for (const [date, list] of days) {
      const withRecipe = list.filter((e) => e.recipe);
      if (withRecipe.length === 0 || withRecipe.some((e) => e.recipe!.carbsPerServingG == null))
        continue;
      const total = withRecipe.reduce((sum, e) => sum + (e.recipe!.carbsPerServingG ?? 0), 0);
      if (total > limit) {
        warnings.push({
          entryId: withRecipe[withRecipe.length - 1]!.id,
          code: "LIMIT_EXCEEDED",
          message: `El ${dayLabel(date)} suma unos ${Math.round(total)} g de carbohidratos (tope ${limit} g).`,
        });
      }
    }
  }

  return { errors, warnings };
}
