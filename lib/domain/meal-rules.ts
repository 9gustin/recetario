/** Fórmulas por momento del plan vivo ↔ recetas. Lógica pura, sin DB ni IA. */
import { nameKey } from "./ingredient-match";

export type FoodGroup = "proteina" | "verdura" | "carbohidrato" | "lacteo" | "fruta" | "grasa";

/** Familias del catálogo (`ingredients.family`) → grupo de alimentos. */
export const FAMILY_GROUP: Record<string, FoodGroup> = {
  carne_roja: "proteina",
  cerdo: "proteina",
  ave: "proteina",
  pescado: "proteina",
  huevo: "proteina",
  legumbre: "proteina",
  hoja_verde: "verdura",
  crucifera: "verdura",
  allium: "verdura",
  solanacea: "verdura",
  cereal: "carbohidrato",
  cereal_gluten: "carbohidrato",
  tuberculo: "carbohidrato",
  lacteo: "lacteo",
  fruta: "fruta",
  citrico: "fruta",
  frutos_secos: "grasa",
  semilla: "grasa",
};

export type MealRule = {
  userId: string;
  displayName: string | null;
  slot: string;
  /** 0 = domingo … 6 = sábado; null = todos los días. */
  days: number[] | null;
  formula: string;
  components: { group: string; portion?: string; allowed?: boolean }[];
};

const WORD_GROUP: Record<string, FoodGroup> = {
  harina: "carbohidrato",
  harinas: "carbohidrato",
  carbohidrato: "carbohidrato",
  carbohidratos: "carbohidrato",
  pasta: "carbohidrato",
  pastas: "carbohidrato",
  lacteo: "lacteo",
  lacteos: "lacteo",
  fruta: "fruta",
  frutas: "fruta",
  grasa: "grasa",
  grasas: "grasa",
  proteina: "proteina",
  proteinas: "proteina",
};

/** Grupos que la fórmula deja afuera: componentes con allowed=false o frases como "sin harinas". */
export function excludedGroups(formula: string, components: MealRule["components"]): FoodGroup[] {
  const out = new Set<FoodGroup>();
  for (const c of components) {
    if (c.allowed === false) {
      const g = WORD_GROUP[nameKey(c.group)] ?? (c.group as FoodGroup);
      if (Object.values(FAMILY_GROUP).includes(g)) out.add(g);
    }
  }
  for (const m of formula
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .matchAll(/\bsin ([a-z]+)/g)) {
    const g = WORD_GROUP[m[1]!];
    if (g) out.add(g);
  }
  return [...out];
}

/** Grupos de alimentos que aparecen (como ingrediente obligatorio) en una receta. */
export function recipeGroups(
  ingredients: { families: string[]; optional: boolean }[],
): Set<FoodGroup> {
  const groups = new Set<FoodGroup>();
  for (const i of ingredients) {
    if (i.optional) continue;
    for (const f of i.families) {
      const g = FAMILY_GROUP[f];
      if (g) groups.add(g);
    }
  }
  return groups;
}

/** Reglas que aplican a una persona en un momento y día dados. */
export function rulesFor(
  rules: MealRule[],
  slot: string,
  date: string,
  dow: (d: string) => number,
  userId?: string,
) {
  return rules.filter(
    (r) =>
      r.slot === slot &&
      (!userId || r.userId === userId) &&
      (!r.days || r.days.length === 0 || r.days.includes(dow(date))),
  );
}

/** Grupos de la receta que la fórmula excluye (vacío = encaja). */
export function mismatchedGroups(
  rule: Pick<MealRule, "formula" | "components">,
  ingredients: { families: string[]; optional: boolean }[],
): FoodGroup[] {
  const excluded = excludedGroups(rule.formula, rule.components);
  const present = recipeGroups(ingredients);
  return excluded.filter((g) => present.has(g));
}
