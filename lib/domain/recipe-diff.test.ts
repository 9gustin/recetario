import { describe, expect, it } from "vitest";
import { diffSnapshots, isEmptyDiff, parseSnapshot, type RecipeSnapshot } from "./recipe-diff";

const base: RecipeSnapshot = {
  title: "Pollo al limón",
  description: null,
  servings: 4,
  prep_minutes: 10,
  cook_minutes: 25,
  total_minutes: 35,
  difficulty: "facil",
  tags: ["pollo"],
  ingredients: [
    {
      raw_text: "2 pechugas",
      quantity: 2,
      unit: null,
      preparation: null,
      section: null,
      optional: false,
      position: 0,
      ingredient_id: "pollo",
    },
    {
      raw_text: "1 limón",
      quantity: 1,
      unit: null,
      preparation: null,
      section: null,
      optional: false,
      position: 1,
      ingredient_id: "limon",
    },
  ],
  steps: [
    {
      position: 0,
      instruction: "Cortá el pollo.",
      duration_seconds: null,
      timer_kind: null,
      tip: null,
      ingredient_ids: [],
    },
    {
      position: 1,
      instruction: "Cociná 20 minutos.",
      duration_seconds: 1200,
      timer_kind: "passive",
      tip: null,
      ingredient_ids: [],
    },
  ],
};

describe("diffSnapshots", () => {
  it("no hay cambios entre dos snapshots iguales", () => {
    expect(isEmptyDiff(diffSnapshots(base, structuredClone(base)))).toBe(true);
  });

  it("detecta campos y tiempos cambiados", () => {
    const d = diffSnapshots(base, {
      ...base,
      title: "Pollo al limón rápido",
      total_minutes: 30,
      tags: ["pollo", "rapida"],
    });
    expect(d.fields.map((f) => f.field)).toEqual(["title", "total_minutes", "tags"]);
    expect(d.fields[1]).toEqual({ field: "total_minutes", from: 35, to: 30 });
  });

  it("detecta ingredientes agregados, quitados y cambiados", () => {
    const next: RecipeSnapshot = {
      ...base,
      ingredients: [
        { ...base.ingredients[0]!, raw_text: "3 pechugas", quantity: 3 },
        {
          raw_text: "sal",
          quantity: null,
          unit: null,
          preparation: null,
          section: null,
          optional: false,
          position: 1,
          ingredient_id: "sal",
        },
      ],
    };
    const d = diffSnapshots(base, next);
    expect(d.ingredients.changed).toHaveLength(1);
    expect(d.ingredients.changed[0]?.after.raw_text).toBe("3 pechugas");
    expect(d.ingredients.added.map((i) => i.raw_text)).toEqual(["sal"]);
    expect(d.ingredients.removed.map((i) => i.raw_text)).toEqual(["1 limón"]);
  });

  it("detecta pasos cambiados, agregados y quitados", () => {
    const changed = diffSnapshots(base, {
      ...base,
      steps: [base.steps[0]!, { ...base.steps[1]!, instruction: "Cociná 25 minutos." }],
    });
    expect(changed.steps.changed).toEqual([
      { position: 2, before: "Cociná 20 minutos.", after: "Cociná 25 minutos." },
    ]);

    const added = diffSnapshots(base, {
      ...base,
      steps: [...base.steps, { ...base.steps[0]!, position: 2, instruction: "Serví." }],
    });
    expect(added.steps.added).toEqual([{ position: 3, instruction: "Serví." }]);

    const removed = diffSnapshots(base, { ...base, steps: [base.steps[0]!] });
    expect(removed.steps.removed).toEqual([{ position: 2, instruction: "Cociná 20 minutos." }]);
  });

  it("sin versión anterior, todo es nuevo", () => {
    const d = diffSnapshots(null, base);
    expect(d.ingredients.added).toHaveLength(2);
    expect(d.steps.added).toHaveLength(2);
  });
});

describe("parseSnapshot", () => {
  it("lee un jsonb de la base y tolera datos faltantes", () => {
    const s = parseSnapshot({
      title: "X",
      servings: "4",
      ingredients: [{ raw_text: "sal", position: 0 }],
      steps: null,
    });
    expect(s.title).toBe("X");
    expect(s.servings).toBe(4);
    expect(s.ingredients[0]?.optional).toBe(false);
    expect(s.steps).toEqual([]);
  });
});
