import { describe, expect, it } from "vitest";
import { cookingReducer, initCookingState } from "./use-cooking-reducer";

const start = () => initCookingState({ steps: 3, servings: 2 });

describe("cookingReducer", () => {
  it("arranca en la mise en place con steps + 2 pantallas", () => {
    const s = start();
    expect(s.index).toBe(0);
    expect(s.total).toBe(5);
  });

  it("NEXT y PREV no se pasan de los bordes", () => {
    let s = start();
    expect(cookingReducer(s, { type: "PREV" })).toBe(s);
    for (let i = 0; i < 10; i++) s = cookingReducer(s, { type: "NEXT" });
    expect(s.index).toBe(4);
    s = cookingReducer(s, { type: "PREV" });
    expect(s.index).toBe(3);
    expect(s.direction).toBe(-1);
  });

  it("GOTO limita el índice y marca la dirección", () => {
    const s = cookingReducer(start(), { type: "GOTO", index: 99 });
    expect(s.index).toBe(4);
    expect(s.direction).toBe(1);
    expect(cookingReducer(s, { type: "GOTO", index: -5 }).index).toBe(0);
  });

  it("COMPLETE marca la pantalla actual sin mutar el estado anterior", () => {
    const s0 = cookingReducer(start(), { type: "NEXT" });
    const s1 = cookingReducer(s0, { type: "COMPLETE" });
    expect(s1.completed.has(1)).toBe(true);
    expect(s0.completed.has(1)).toBe(false);
    expect(cookingReducer(s1, { type: "COMPLETE" })).toBe(s1);
  });

  it("SET_SERVINGS ignora valores no positivos", () => {
    const s = start();
    expect(cookingReducer(s, { type: "SET_SERVINGS", servings: 4 }).servings).toBe(4);
    expect(cookingReducer(s, { type: "SET_SERVINGS", servings: 0 })).toBe(s);
  });

  it("puede retomar desde un paso ya avanzado", () => {
    const s = initCookingState({ steps: 3, servings: 2, index: 3, completed: [0, 1, 2] });
    expect(s.index).toBe(3);
    expect(s.completed.size).toBe(3);
  });
});
