/** Textos y datos que muestra el modo cocinar. Lógica pura, sin DB ni IA. */
import { formatQuantity } from "./format";
import { parseIngredientLine } from "./ingredient-line";
import { scaleQuantity } from "./scale";

export type CookingIngredient = {
  id: string;
  ingredient_id: string | null;
  raw_text: string | null;
  quantity: number | null;
  unit: string | null;
  preparation: string | null;
  optional: boolean;
};

export type CookingStep = {
  instruction: string;
  duration_seconds: number | null;
  ingredient_ids: string[] | null;
};

const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** "400 g de pollo", "2 pechugas de pollo" o "sal a gusto", escalado a `toServings`. */
export function scaledIngredientLabel(
  ing: Pick<CookingIngredient, "raw_text" | "quantity" | "unit">,
  fromServings: number,
  toServings: number,
): string {
  const name = parseIngredientLine(ing.raw_text ?? "").name || ing.raw_text || "";
  if (ing.quantity === null) return ing.raw_text ?? name;
  const qty = scaleQuantity(ing.quantity, fromServings, toServings);
  if (ing.unit === null || ing.unit === "unidad") return `${formatQuantity(qty, null)} ${name}`;
  return `${formatQuantity(qty, ing.unit)} de ${name}`;
}

/**
 * Ingredientes de un paso: los vinculados por id (de la receta o del catálogo) y, si el paso no
 * tiene ninguno, los que se nombran en su texto.
 */
export function ingredientsForStep<I extends CookingIngredient>(
  step: CookingStep,
  ingredients: I[],
): I[] {
  const ids = new Set(step.ingredient_ids ?? []);
  if (ids.size > 0) {
    return ingredients.filter(
      (i) => ids.has(i.id) || (i.ingredient_id !== null && ids.has(i.ingredient_id)),
    );
  }
  const text = ` ${normalize(step.instruction).replace(/[^a-z0-9ñ ]+/g, " ")} `;
  return ingredients.filter((i) => {
    const name = normalize(parseIngredientLine(i.raw_text ?? "").name).trim();
    // Con las palabras sueltas ("pechugas de pollo" → "pollo") para no depender del texto exacto.
    const words = name.split(/\s+/).filter((w) => w.length >= 4);
    return words.some((w) => text.includes(` ${w}`) || text.includes(` ${w.replace(/s$/, "")}`));
  });
}

/** Mm:ss de una duración en segundos. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** Tamaño (px) del texto del paso según su largo, siempre ≥ 22. */
export function instructionFontSize(text: string): number {
  if (text.length <= 90) return 33;
  if (text.length <= 160) return 28;
  return 24;
}

/** Tiempo total estimado: el de la receta o, si no, la suma de las duraciones de los pasos. */
export function estimatedMinutes(
  recipe: { total_minutes: number | null },
  steps: { duration_seconds: number | null }[],
): number | null {
  if (recipe.total_minutes) return recipe.total_minutes;
  const sum = steps.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0);
  return sum > 0 ? Math.ceil(sum / 60) : null;
}
