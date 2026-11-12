import { describe, expect, it } from "vitest";
import {
  checkRecipe,
  checkRecipeForGroup,
  type CheckRestriction,
  type RecipeIngredientForCheck,
} from "./compatibility";

const ing = (
  name: string,
  over: Partial<RecipeIngredientForCheck> = {},
): RecipeIngredientForCheck => ({
  ingredientId: `id-${name}`,
  name,
  families: [],
  optional: false,
  ...over,
});

const noOnion: CheckRestriction = { target: "cebolla", type: "ingredient", severity: "forbidden" };
const noAllium: CheckRestriction = { target: "allium", type: "family", severity: "forbidden" };

describe("checkRecipe: sin restricciones", () => {
  it("una persona sin restricciones siempre es ok", () => {
    expect(checkRecipe([ing("cebolla")], [])).toEqual({ status: "ok", reasons: [] });
  });
});

describe("checkRecipe: ingrediente", () => {
  it("cebolla directa → forbidden", () => {
    const r = checkRecipe([ing("pollo"), ing("cebolla", { families: ["allium"] })], [noOnion]);
    expect(r.status).toBe("forbidden");
    expect(r.reasons).toEqual([
      { ingredient: "cebolla", restriction: "cebolla", severity: "forbidden", note: undefined },
    ]);
  });

  it("coincide por alias y por plural/artículos", () => {
    expect(checkRecipe([ing("cebollas")], [noOnion]).status).toBe("forbidden");
    expect(checkRecipe([ing("cebolla común", { aliases: ["cebolla"] })], [noOnion]).status).toBe(
      "forbidden",
    );
  });

  it("una variedad (cebolla morada) cuenta como cebolla", () => {
    expect(checkRecipe([ing("cebolla morada")], [noOnion]).status).toBe("forbidden");
  });

  it("verdeo con solo la cebolla prohibida NO se asume (decisión de producto)", () => {
    expect(
      checkRecipe([ing("cebolla de verdeo", { families: ["allium"] })], [noOnion]).status,
    ).toBe("ok");
    expect(checkRecipe([ing("cebolla del campo")], [noOnion]).status).toBe("ok");
  });

  it("verdeo SÍ se prohíbe si la persona lo confirmó en includes", () => {
    const withIncludes: CheckRestriction = {
      ...noOnion,
      includes: ["cebolla de verdeo", "puerro"],
    };
    expect(checkRecipe([ing("cebolla de verdeo")], [withIncludes]).status).toBe("forbidden");
    expect(checkRecipe([ing("puerro")], [withIncludes]).status).toBe("forbidden");
    expect(checkRecipe([ing("ajo")], [withIncludes]).status).toBe("ok");
  });
});

describe("checkRecipe: familia", () => {
  it("verdeo con la familia allium prohibida → forbidden", () => {
    expect(
      checkRecipe([ing("cebolla de verdeo", { families: ["allium"] })], [noAllium]).status,
    ).toBe("forbidden");
  });
  it("ignora mayúsculas y espacios del objetivo, y no matchea otras familias", () => {
    const r: CheckRestriction = { target: " Allium ", type: "family", severity: "forbidden" };
    expect(checkRecipe([ing("ajo", { families: ["allium"] })], [r]).status).toBe("forbidden");
    expect(checkRecipe([ing("pollo", { families: ["ave"] })], [r]).status).toBe("ok");
  });
});

describe("checkRecipe: categoría", () => {
  const noFlour: CheckRestriction = {
    target: "harinas refinadas",
    type: "category",
    severity: "limit",
    limit: "evitar en la cena",
  };

  it("mapea la categoría a familias del catálogo y devuelve la regla en la nota", () => {
    const r = checkRecipe([ing("harina 000", { families: ["cereal_gluten"] })], [noFlour]);
    expect(r.status).toBe("limit");
    expect(r.reasons[0]).toMatchObject({ severity: "limit", note: "evitar en la cena" });
  });

  it("categoría sin familias conocidas: compara por texto", () => {
    const r: CheckRestriction = { target: "azúcar", type: "category", severity: "limit" };
    expect(checkRecipe([ing("azúcar impalpable")], [r]).status).toBe("limit");
    expect(checkRecipe([ing("sal")], [r]).status).toBe("ok");
  });

  it("categoría conocida pero el ingrediente no es de esas familias y tampoco coincide por texto", () => {
    expect(
      checkRecipe(
        [ing("arroz yamaní", { families: ["cereal"] }), ing("pollo")],
        [{ ...noFlour, target: "legumbres" }],
      ).status,
    ).toBe("ok");
  });
});

describe("checkRecipe: opcional, desconocidos y prioridad", () => {
  it("un ingrediente opcional prohibido pasa a limit con 'sacalo'", () => {
    const r = checkRecipe([ing("cebolla", { optional: true })], [noOnion]);
    expect(r.status).toBe("limit");
    expect(r.reasons[0]).toMatchObject({ severity: "limit", note: "es opcional, sacalo" });
  });

  it("un ingrediente opcional con restricción 'limit' sigue siendo limit con la regla", () => {
    const r = checkRecipe(
      [ing("harina", { families: ["cereal_gluten"], optional: true })],
      [{ target: "harinas", type: "category", severity: "limit", limit: "pocas" }],
    );
    expect(r.reasons[0]).toMatchObject({ severity: "limit", note: "pocas" });
  });

  it("un ingrediente sin vínculo al catálogo (y sin coincidencia) aporta unknown", () => {
    const r = checkRecipe([ing("especia rara", { ingredientId: null })], [noOnion]);
    expect(r.status).toBe("unknown");
    expect(r.reasons[0]).toMatchObject({ severity: "unknown", ingredient: "especia rara" });
  });

  it("sin vínculo pero que coincide por texto es forbidden, no unknown", () => {
    const r = checkRecipe([ing("cebolla", { ingredientId: null })], [noOnion]);
    expect(r.status).toBe("forbidden");
    expect(r.reasons.map((x) => x.severity)).toEqual(["forbidden"]);
  });

  it("varias restricciones sobre un mismo ingrediente suman razones", () => {
    const r = checkRecipe(
      [ing("cebolla de verdeo", { families: ["allium"] })],
      [noAllium, { target: "cebolla de verdeo", type: "ingredient", severity: "limit" }],
    );
    expect(r.reasons).toHaveLength(2);
    expect(r.status).toBe("forbidden");
  });

  it("prioridad: forbidden > limit > unknown > ok", () => {
    const limit: CheckRestriction = { target: "azúcar", type: "ingredient", severity: "limit" };
    const unknown = ing("rara", { ingredientId: null });
    expect(checkRecipe([unknown, ing("azúcar"), ing("cebolla")], [noOnion, limit]).status).toBe(
      "forbidden",
    );
    expect(checkRecipe([unknown, ing("azúcar")], [noOnion, limit]).status).toBe("limit");
    expect(checkRecipe([unknown, ing("pollo")], [noOnion, limit]).status).toBe("unknown");
    expect(checkRecipe([ing("pollo")], [noOnion, limit]).status).toBe("ok");
  });

  it("no baja de nivel si después aparece algo menos grave", () => {
    expect(
      checkRecipe([ing("cebolla"), ing("rara", { ingredientId: null })], [noOnion]).status,
    ).toBe("forbidden");
  });
});

describe("checkRecipeForGroup", () => {
  it("devuelve un resultado por persona", () => {
    const res = checkRecipeForGroup(
      [ing("cebolla")],
      [
        { userId: "a", displayName: "Ana", restrictions: [noOnion] },
        { userId: "b", displayName: null, restrictions: [] },
      ],
    );
    expect(res.map((r) => [r.userId, r.status])).toEqual([
      ["a", "forbidden"],
      ["b", "ok"],
    ]);
    expect(res[1]?.displayName).toBeNull();
  });
});
