import { describe, expect, it } from "vitest";
import { pickIdeas, scoreIdea, sinceLabel, type RecipeSignal } from "./signals";

const sig = (over: Partial<RecipeSignal> = {}): RecipeSignal => ({
  recipeId: "r",
  daysSinceCooked: 8,
  servings: 4,
  totalMinutes: 45,
  ...over,
});
const ctx = { hour: 12, diners: 2 };

describe("sinceLabel", () => {
  it("días, una semana y semanas", () => {
    expect(sinceLabel(3)).toBe("Hace 3 días");
    expect(sinceLabel(7)).toBe("Hace una semana");
    expect(sinceLabel(21)).toBe("Hace 3 semanas");
  });
});

describe("scoreIdea", () => {
  it("lo que vence pronto gana y lo dice", () => {
    const r = scoreIdea(sig({ expiringIngredients: ["La rúcula"] }), ctx);
    expect(r.reason).toBe("La rúcula vence pronto: aprovechalo hoy");
    expect(r.score).toBeGreaterThanOrEqual(5);
  });

  it("nunca cocinada y hace tiempo que no se cocina", () => {
    expect(scoreIdea(sig({ daysSinceCooked: null }), ctx).reason).toBe("Todavía no la cocinaste");
    expect(scoreIdea(sig({ daysSinceCooked: 21 }), ctx).reason).toBe(
      "Hace 3 semanas que no la cocinás",
    );
  });

  it("penaliza lo cocinado hace menos de 4 días", () => {
    expect(scoreIdea(sig({ daysSinceCooked: 2 }), ctx).score).toBeLessThan(0);
  });

  it("rinde para sobras si las porciones duplican a los comensales", () => {
    const r = scoreIdea(sig({ servings: 4, totalMinutes: 60 }), ctx);
    expect(r.reason).toBe("Rinde para sobras: mañana ya tenés resuelto");
    expect(scoreIdea(sig({ servings: 3, totalMinutes: 60 }), ctx).reason).toBe(
      "Una opción simple de tu recetario",
    );
    expect(scoreIdea(sig({ servings: 4 }), { hour: 12, diners: 0 }).score).toBe(0);
  });

  it("de noche prioriza lo rápido; de día, lo muy rápido", () => {
    expect(scoreIdea(sig({ totalMinutes: 25, servings: 2 }), { hour: 21, diners: 2 }).reason).toBe(
      "Sale en 25 minutos: ideal a esta hora",
    );
    expect(scoreIdea(sig({ totalMinutes: 15, servings: 2 }), ctx).reason).toBe(
      "Está lista en 15 minutos",
    );
    expect(scoreIdea(sig({ totalMinutes: null, servings: 2 }), ctx).reason).toBe(
      "Una opción simple de tu recetario",
    );
  });
});

describe("pickIdeas", () => {
  const list = [
    sig({ recipeId: "a", daysSinceCooked: 30 }),
    sig({ recipeId: "b", daysSinceCooked: 1 }),
    sig({ recipeId: "c", daysSinceCooked: null }),
    sig({ recipeId: "d", daysSinceCooked: 14 }),
    sig({ recipeId: "e", daysSinceCooked: 9 }),
  ];

  it("devuelve las 3 mejores en orden", () => {
    expect(pickIdeas(list, ctx).map((i) => i.recipeId)).toEqual(["a", "d", "c"]);
  });

  it("'otras 3' excluye las ya mostradas", () => {
    const first = pickIdeas(list, ctx).map((i) => i.recipeId);
    const next = pickIdeas(list, ctx, first).map((i) => i.recipeId);
    expect(next.sort()).toEqual(["b", "e"]);
  });
});
