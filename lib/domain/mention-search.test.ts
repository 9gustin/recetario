import { describe, expect, it } from "vitest";
import { filterMentionCandidates } from "./mention-search";

const recipes = [
  { id: "1", title: "Pollo al limón" },
  { id: "2", title: "Salmón con rúcula" },
  { id: "3", title: "Ensalada de salmón" },
  { id: "4", title: "Puré de calabaza" },
];

describe("filterMentionCandidates", () => {
  it("encuentra por prefijo sin importar acentos ni mayúsculas", () => {
    expect(filterMentionCandidates(recipes, "Salm").map((r) => r.id)).toEqual(["2", "3"]);
    expect(filterMentionCandidates(recipes, "salmon").map((r) => r.id)).toEqual(["2", "3"]);
    expect(filterMentionCandidates(recipes, "POLLO").map((r) => r.id)).toEqual(["1"]);
  });
  it("pone primero los que empiezan igual y después los que contienen", () => {
    expect(filterMentionCandidates(recipes, "salm").map((r) => r.id)).toEqual(["2", "3"]);
    expect(filterMentionCandidates(recipes, "pur").map((r) => r.id)).toEqual(["4"]);
  });
  it("sin texto devuelve las primeras, y respeta el límite", () => {
    expect(filterMentionCandidates(recipes, "", 2)).toHaveLength(2);
    expect(filterMentionCandidates(recipes, "@", 3)).toHaveLength(3);
  });
  it("sin coincidencias devuelve vacío", () => {
    expect(filterMentionCandidates(recipes, "pizza")).toEqual([]);
  });
});
