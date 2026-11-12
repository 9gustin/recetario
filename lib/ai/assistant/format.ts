/** Formateo del contexto que se le pasa al asistente. Lógica pura. */
import { formatClock } from "@/lib/domain/cooking-display";

export type PromptRecipe = {
  id: string;
  title: string;
  servings: number;
  total_minutes: number | null;
  tags: string[];
  ingredients: { raw_text: string | null }[];
  steps: { instruction: string; duration_seconds: number | null }[];
};

export type CookingContext = {
  recipe: PromptRecipe;
  /** Pantalla actual: 0 = mise en place, 1..n = pasos, n+1 = final. */
  step: number;
  servings: number;
  timers: { label: string; remaining_seconds: number }[];
};

export function formatRecipeForPrompt(r: PromptRecipe): string {
  const ingredients = r.ingredients.map((i) => `- ${i.raw_text ?? ""}`).join("\n");
  const steps = r.steps
    .map(
      (s, i) =>
        `${i + 1}. ${s.instruction}${s.duration_seconds ? ` (${Math.round(s.duration_seconds / 60)} min)` : ""}`,
    )
    .join("\n");
  return [
    `Receta "${r.title}" (id: ${r.id}) — ${r.servings} porciones${r.total_minutes ? `, ${r.total_minutes} min` : ""}${r.tags.length ? `, etiquetas: ${r.tags.join(", ")}` : ""}`,
    `Ingredientes:\n${ingredients}`,
    `Pasos:\n${steps}`,
  ].join("\n");
}

export function formatCookingContext(c: CookingContext): string {
  const n = c.recipe.steps.length;
  const where =
    c.step <= 0
      ? "todavía está en la mise en place (preparando ingredientes)"
      : c.step > n
        ? "ya terminó todos los pasos"
        : `está en el paso ${c.step} de ${n}: "${c.recipe.steps[c.step - 1]?.instruction ?? ""}"`;
  const timers = c.timers.length
    ? `Timers activos: ${c.timers.map((t) => `${t.label} (${formatClock(t.remaining_seconds)} restantes)`).join("; ")}.`
    : "No hay timers activos.";
  return `MODO COCINAR: la persona está cocinando "${c.recipe.title}" para ${c.servings} porciones (la receta original es para ${c.recipe.servings}) y ${where}. ${timers}`;
}

/** Bloque de contexto inicial: recetas citadas + (si cocina) el estado de la sesión. */
export function buildContextText(opts: {
  mentioned: PromptRecipe[];
  cooking?: CookingContext | null;
}): string {
  const parts: string[] = [];
  if (opts.cooking) parts.push(formatCookingContext(opts.cooking));
  const alreadyShown = opts.cooking?.recipe.id;
  const others = opts.mentioned.filter((r) => r.id !== alreadyShown);
  if (opts.cooking) parts.push(formatRecipeForPrompt(opts.cooking.recipe));
  if (others.length)
    parts.push(
      `Recetas citadas por la persona:\n\n${others.map(formatRecipeForPrompt).join("\n\n")}`,
    );
  return parts.join("\n\n");
}
