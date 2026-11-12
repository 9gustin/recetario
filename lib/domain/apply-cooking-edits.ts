/**
 * Ajustes hechos mientras se cocina. Se guardan como una lista de operaciones y se aplican, en
 * orden, sobre la receta original. Cada operación usa los índices de la receta **tal como estaba
 * al hacerla** (la UI siempre trabaja sobre la receta ya modificada). Lógica pura, sin DB.
 */

export type EditIngredient = {
  id: string;
  ingredient_id: string | null;
  raw_text: string | null;
  quantity: number | null;
  unit: string | null;
  preparation: string | null;
  section: string | null;
  optional: boolean;
  position: number;
};

export type EditStep = {
  id: string;
  position: number;
  instruction: string;
  duration_seconds: number | null;
  timer_kind: string | null;
  tip: string | null;
  ingredient_ids: string[] | null;
};

export type EditableRecipe = { ingredients: EditIngredient[]; steps: EditStep[] };

export type CookingEdit =
  | { op: "edit_text"; step: number; text: string }
  | { op: "set_duration"; step: number; seconds: number | null }
  | { op: "set_ingredient_qty"; ingredient: number; quantity: number }
  | { op: "add_step_after"; step: number; text: string; seconds: number | null }
  | { op: "delete_step"; step: number };

/** Reemplaza el número del principio del texto ("200 g de harina" → "300 g de harina"). */
export function replaceLeadingNumber(text: string | null, quantity: number): string | null {
  if (!text) return text;
  const match = text.match(
    /^\s*(?:\d+\s+y\s+)?(?:\d+[.,]?\d*(?:\s*\/\s*\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])(?:\s+\d\s*\/\s*\d)?/,
  );
  if (!match) return text;
  const formatted = Number.isInteger(quantity)
    ? String(quantity)
    : String(Math.round(quantity * 100) / 100).replace(".", ",");
  return formatted + text.slice(match[0].length);
}

const reindex = (steps: EditStep[]): EditStep[] => steps.map((s, i) => ({ ...s, position: i }));

function applyOne(recipe: EditableRecipe, edit: CookingEdit, seq: number): EditableRecipe {
  const { steps, ingredients } = recipe;
  switch (edit.op) {
    case "edit_text": {
      const text = edit.text.trim();
      if (!steps[edit.step] || !text) return recipe;
      return {
        ingredients,
        steps: steps.map((s, i) => (i === edit.step ? { ...s, instruction: text } : s)),
      };
    }
    case "set_duration": {
      if (!steps[edit.step]) return recipe;
      const seconds = edit.seconds && edit.seconds > 0 ? Math.round(edit.seconds) : null;
      return {
        ingredients,
        steps: steps.map((s, i) =>
          i === edit.step
            ? {
                ...s,
                duration_seconds: seconds,
                timer_kind: seconds ? (s.timer_kind ?? "active") : null,
              }
            : s,
        ),
      };
    }
    case "set_ingredient_qty": {
      if (!ingredients[edit.ingredient] || !(edit.quantity > 0)) return recipe;
      return {
        steps,
        ingredients: ingredients.map((ing, i) =>
          i === edit.ingredient
            ? {
                ...ing,
                quantity: edit.quantity,
                raw_text: replaceLeadingNumber(ing.raw_text, edit.quantity),
              }
            : ing,
        ),
      };
    }
    case "add_step_after": {
      const text = edit.text.trim();
      if (!text || edit.step < -1 || edit.step >= steps.length) return recipe;
      const seconds = edit.seconds && edit.seconds > 0 ? Math.round(edit.seconds) : null;
      const created: EditStep = {
        id: `edit-${seq}`,
        position: 0,
        instruction: text,
        duration_seconds: seconds,
        timer_kind: seconds ? "active" : null,
        tip: null,
        ingredient_ids: [],
      };
      return {
        ingredients,
        steps: reindex([...steps.slice(0, edit.step + 1), created, ...steps.slice(edit.step + 1)]),
      };
    }
    case "delete_step": {
      // Una receta necesita al menos un paso.
      if (!steps[edit.step] || steps.length <= 1) return recipe;
      return { ingredients, steps: reindex(steps.filter((_, i) => i !== edit.step)) };
    }
  }
}

/** Devuelve la receta con todos los ajustes aplicados (sin modificar la original). */
export function applyCookingEdits(recipe: EditableRecipe, edits: CookingEdit[]): EditableRecipe {
  return edits.reduce((acc, edit, i) => applyOne(acc, edit, i), recipe);
}
