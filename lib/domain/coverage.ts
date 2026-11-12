/** Cuánto de una receta se puede hacer con lo que hay en casa. Lógica pura, sin DB ni IA. */
import { nameKey } from "./ingredient-match";

/** Básicos de alacena que se asumen siempre: no cuentan como "falta". */
export const PANTRY_BASICS = [
  "sal",
  "aceite",
  "pimienta",
  "agua",
  "azucar",
  "aceite de oliva",
  "sal gruesa",
  "sal fina",
];

const BASIC_KEYS = new Set(PANTRY_BASICS.map(nameKey));

export type CoverageIngredient = { name: string; aliases?: string[]; optional: boolean };

export type Coverage = {
  have: string[];
  missing: string[];
  missingOptional: string[];
  /** 0–1: proporción de ingredientes obligatorios (sin contar básicos) que ya tenés. */
  score: number;
};

const tokens = (key: string) => key.split(" ").filter(Boolean);

/** ¿"pollo" cubre "pechuga de pollo"? Sí: alcanza con que todas las palabras de uno estén en el otro. */
function covers(haveKey: string, ingredientKey: string): boolean {
  if (!haveKey || !ingredientKey) return false;
  if (haveKey === ingredientKey) return true;
  const h = tokens(haveKey);
  const i = tokens(ingredientKey);
  return h.every((t) => i.includes(t)) || i.every((t) => h.includes(t));
}

export function computeCoverage(have: string[], ingredients: CoverageIngredient[]): Coverage {
  const haveKeys = have.map(nameKey).filter(Boolean);
  const result: Coverage = { have: [], missing: [], missingOptional: [], score: 1 };
  let required = 0;
  let covered = 0;

  for (const ing of ingredients) {
    const keys = [ing.name, ...(ing.aliases ?? [])].map(nameKey).filter(Boolean);
    if (keys.length === 0 || keys.some((k) => BASIC_KEYS.has(k))) continue;
    const isCovered = keys.some((k) => haveKeys.some((h) => covers(h, k)));
    if (!ing.optional) required++;
    if (isCovered) {
      result.have.push(ing.name);
      if (!ing.optional) covered++;
    } else if (ing.optional) {
      result.missingOptional.push(ing.name);
    } else {
      result.missing.push(ing.name);
    }
  }
  result.score = required === 0 ? 1 : covered / required;
  return result;
}

/** Texto corto para la tarjeta: "Tenés todo" o "Te falta: jengibre (opcional)". */
export function coverageLabel(c: Coverage): string {
  if (c.missing.length === 0 && c.missingOptional.length === 0) return "Tenés todo";
  const parts = [...c.missing, ...c.missingOptional.map((m) => `${m} (opcional)`)];
  return `Te falta: ${parts.join(", ")}`;
}

/** Separa un dictado o una línea ("pollo, zapallitos y huevos") en ingredientes sueltos. */
export function splitIngredients(text: string): string[] {
  return text
    .split(/,|;|\n|\s+y\s+|\s+e\s+/i)
    .map((s) =>
      s
        .trim()
        .replace(/^(tengo|hay|me quedan?|tenemos)\s+/i, "")
        .replace(/\.$/, ""),
    )
    .filter((s) => s.length > 0 && s.length <= 60);
}
