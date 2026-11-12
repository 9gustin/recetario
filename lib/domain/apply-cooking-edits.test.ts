import { describe, expect, it } from "vitest";
import {
  applyCookingEdits,
  replaceLeadingNumber,
  type CookingEdit,
  type EditableRecipe,
} from "./apply-cooking-edits";

const base: EditableRecipe = {
  ingredients: [
    {
      id: "i1",
      ingredient_id: null,
      raw_text: "200 g de harina",
      quantity: 200,
      unit: "g",
      preparation: null,
      section: null,
      optional: false,
      position: 0,
    },
    {
      id: "i2",
      ingredient_id: null,
      raw_text: "sal a gusto",
      quantity: null,
      unit: null,
      preparation: null,
      section: null,
      optional: false,
      position: 1,
    },
  ],
  steps: [
    {
      id: "s1",
      position: 0,
      instruction: "Mezclá.",
      duration_seconds: null,
      timer_kind: null,
      tip: null,
      ingredient_ids: [],
    },
    {
      id: "s2",
      position: 1,
      instruction: "Horneá.",
      duration_seconds: 1500,
      timer_kind: "passive",
      tip: null,
      ingredient_ids: [],
    },
  ],
};

const apply = (...edits: CookingEdit[]) => applyCookingEdits(base, edits);

describe("applyCookingEdits", () => {
  it("sin ajustes devuelve la misma receta", () => {
    expect(applyCookingEdits(base, [])).toEqual(base);
  });

  it("edit_text cambia el texto del paso", () => {
    expect(apply({ op: "edit_text", step: 0, text: "  Mezclá bien. " }).steps[0]?.instruction).toBe(
      "Mezclá bien.",
    );
  });

  it("set_duration cambia o quita la duración (y el tipo de timer)", () => {
    const changed = apply({ op: "set_duration", step: 1, seconds: 1800 });
    expect(changed.steps[1]).toMatchObject({ duration_seconds: 1800, timer_kind: "passive" });
    const removed = apply({ op: "set_duration", step: 1, seconds: null });
    expect(removed.steps[1]).toMatchObject({ duration_seconds: null, timer_kind: null });
    const added = apply({ op: "set_duration", step: 0, seconds: 300 });
    expect(added.steps[0]).toMatchObject({ duration_seconds: 300, timer_kind: "active" });
  });

  it("set_ingredient_qty actualiza la cantidad y el texto", () => {
    const r = apply({ op: "set_ingredient_qty", ingredient: 0, quantity: 300 });
    expect(r.ingredients[0]).toMatchObject({ quantity: 300, raw_text: "300 g de harina" });
  });

  it("add_step_after inserta el paso y reordena las posiciones", () => {
    const r = apply({ op: "add_step_after", step: 0, text: "Dejá reposar.", seconds: 600 });
    expect(r.steps.map((s) => s.instruction)).toEqual(["Mezclá.", "Dejá reposar.", "Horneá."]);
    expect(r.steps.map((s) => s.position)).toEqual([0, 1, 2]);
    expect(r.steps[1]).toMatchObject({ duration_seconds: 600, timer_kind: "active" });
    expect(new Set(r.steps.map((s) => s.id)).size).toBe(3);
  });

  it("delete_step quita el paso pero nunca deja la receta sin pasos", () => {
    const r = apply({ op: "delete_step", step: 0 });
    expect(r.steps.map((s) => s.instruction)).toEqual(["Horneá."]);
    expect(applyCookingEdits(r, [{ op: "delete_step", step: 0 }]).steps).toHaveLength(1);
  });

  it("aplica varias operaciones en orden, con índices de la receta ya modificada", () => {
    const r = apply(
      { op: "add_step_after", step: 1, text: "Serví.", seconds: null },
      { op: "edit_text", step: 2, text: "Serví caliente." },
      { op: "set_duration", step: 1, seconds: 1800 },
    );
    expect(r.steps.map((s) => s.instruction)).toEqual(["Mezclá.", "Horneá.", "Serví caliente."]);
    expect(r.steps[1]?.duration_seconds).toBe(1800);
  });

  it("ignora operaciones con índices inválidos y no muta la original", () => {
    const snapshot = structuredClone(base);
    const r = apply(
      { op: "edit_text", step: 9, text: "x" },
      { op: "set_ingredient_qty", ingredient: 9, quantity: 1 },
      { op: "edit_text", step: 0, text: "  " },
    );
    expect(r).toEqual(base);
    expect(base).toEqual(snapshot);
  });
});

describe("replaceLeadingNumber", () => {
  it.each([
    ["200 g de harina", 300, "300 g de harina"],
    ["1/2 taza de leche", 1, "1 taza de leche"],
    ["1 1/2 tazas de azúcar", 2, "2 tazas de azúcar"],
    ["½ cebolla", 1, "1 cebolla"],
    ["2,5 kg de papa", 3, "3 kg de papa"],
    ["sal a gusto", 3, "sal a gusto"],
    ["200 g de harina", 1.25, "1,25 g de harina"],
  ])("%s → %d", (text, qty, expected) => {
    expect(replaceLeadingNumber(text, qty)).toBe(expected);
  });
});
