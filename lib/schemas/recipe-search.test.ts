import { describe, expect, it } from "vitest";
import { ingredientSearchSchema, recipeSearchSchema } from "./recipe-search";

const groupId = "6f1f2b0e-6a5b-4a5e-9b52-2f2f6f3b1c11";

describe("recipeSearchSchema", () => {
  it("aplica los valores por defecto de paginación", () => {
    const parsed = recipeSearchSchema.parse({ groupId });
    expect(parsed.offset).toBe(0);
    expect(parsed.limit).toBe(24);
  });

  it("rechaza grupos que no son uuid y límites excesivos", () => {
    expect(recipeSearchSchema.safeParse({ groupId: "x" }).success).toBe(false);
    expect(recipeSearchSchema.safeParse({ groupId, limit: 500 }).success).toBe(false);
  });
});

describe("ingredientSearchSchema", () => {
  it("pide al menos 2 caracteres", () => {
    expect(ingredientSearchSchema.safeParse({ q: "a" }).success).toBe(false);
    expect(ingredientSearchSchema.safeParse({ q: "po" }).success).toBe(true);
  });
});
