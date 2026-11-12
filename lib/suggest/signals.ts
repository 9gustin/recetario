/** Señales determinísticas para sugerir qué cocinar hoy. Lógica pura, sin DB ni IA. */

export type RecipeSignal = {
  recipeId: string;
  /** Días desde la última vez que se cocinó (null = nunca). */
  daysSinceCooked: number | null;
  servings: number;
  totalMinutes: number | null;
  /** Ingredientes perecederos que se compraron y vencen pronto (desde la lista de compras, Etapa 8). */
  expiringIngredients?: string[];
};

export type SignalContext = {
  /** Hora local (0–23). */
  hour: number;
  /** Cuántas personas comen. */
  diners: number;
};

export type ScoredIdea = { recipeId: string; score: number; reason: string };

/** "Hace 3 semanas" / "Hace 10 días". */
export function sinceLabel(days: number): string {
  if (days >= 14) return `Hace ${Math.floor(days / 7)} semanas`;
  if (days >= 7) return "Hace una semana";
  return `Hace ${days} días`;
}

/** Puntaje y motivo principal de una receta para hoy. El motivo es siempre algo verificable. */
export function scoreIdea(s: RecipeSignal, ctx: SignalContext): ScoredIdea {
  let score = 0;
  const reasons: { weight: number; text: string }[] = [];
  const add = (weight: number, text: string) => {
    score += weight;
    reasons.push({ weight, text });
  };

  if (s.expiringIngredients?.length) {
    const first = s.expiringIngredients[0]!;
    add(5, `${first} vence pronto: aprovechalo hoy`);
  }
  if (s.daysSinceCooked === null) {
    add(2, "Todavía no la cocinaste");
  } else if (s.daysSinceCooked >= 14) {
    add(3, `${sinceLabel(s.daysSinceCooked)} que no la cocinás`);
  } else if (s.daysSinceCooked < 4) {
    score -= 3; // se cocinó hace nada: no repetir
  }
  if (s.servings >= ctx.diners * 2 && ctx.diners > 0)
    add(1.5, "Rinde para sobras: mañana ya tenés resuelto");
  // De noche (después de las 20 h) conviene algo rápido.
  if (s.totalMinutes !== null && ctx.hour >= 20 && s.totalMinutes <= 30) {
    add(2, `Sale en ${s.totalMinutes} minutos: ideal a esta hora`);
  } else if (s.totalMinutes !== null && s.totalMinutes <= 20) {
    add(1, `Está lista en ${s.totalMinutes} minutos`);
  }

  const best = [...reasons].sort((a, b) => b.weight - a.weight)[0];
  return {
    recipeId: s.recipeId,
    score,
    reason: best?.text ?? "Una opción simple de tu recetario",
  };
}

/** Las mejores `limit` ideas, sin las que ya se mostraron. */
export function pickIdeas(
  signals: RecipeSignal[],
  ctx: SignalContext,
  exclude: string[] = [],
  limit = 3,
): ScoredIdea[] {
  const skip = new Set(exclude);
  return signals
    .filter((s) => !skip.has(s.recipeId))
    .map((s) => scoreIdea(s, ctx))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
