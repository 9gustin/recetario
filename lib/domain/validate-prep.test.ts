import { describe, expect, it } from "vitest";
import { validatePrep, type PrepEntryInfo, type PrepTaskInput } from "./validate-prep";

const task = (over: Partial<PrepTaskInput> = {}): PrepTaskInput => ({
  title: "Cortar verduras",
  suggested_date: "2026-11-15",
  kind: "cut",
  related_entry_ids: ["e1"],
  ...over,
});
const entries: PrepEntryInfo[] = [
  { id: "e1", useDate: "2026-11-17", shelfDays: 3 },
  { id: "e2", useDate: "2026-11-21", shelfDays: 2 },
  { id: "e3", useDate: "2026-11-18", shelfDays: null },
];
const run = (t: PrepTaskInput) => validatePrep([t], entries, "2026-11-15");

describe("validatePrep", () => {
  it("acepta una tarea razonable", () => {
    expect(run(task()).valid).toHaveLength(1);
  });
  it("rechaza antes de la compra y después del uso", () => {
    expect(run(task({ suggested_date: "2026-11-14" })).rejected[0]?.reason).toContain(
      "antes de la compra",
    );
    expect(run(task({ suggested_date: "2026-11-18" })).rejected[0]?.reason).toContain("después");
  });
  it("rechaza lo que supera la vida útil, salvo congelar", () => {
    const far = task({ related_entry_ids: ["e2"], suggested_date: "2026-11-15" });
    expect(run(far).rejected[0]?.reason).toContain("congelarlo");
    expect(
      run({ ...far, kind: "portion", title: "Porcionar y freezar el pollo" }).valid,
    ).toHaveLength(1);
    expect(run({ ...far, kind: "portion", title: "Porcionar el pollo" }).rejected).toHaveLength(1);
  });
  it("sin dato de vida útil no rechaza", () => {
    expect(run(task({ related_entry_ids: ["e3"] })).valid).toHaveLength(1);
  });
  it("descongelar: el día anterior sí, antes no", () => {
    expect(run(task({ kind: "thaw", suggested_date: "2026-11-16" })).valid).toHaveLength(1);
    expect(run(task({ kind: "thaw", suggested_date: "2026-11-17" })).valid).toHaveLength(1);
    expect(run(task({ kind: "thaw", suggested_date: "2026-11-15" })).rejected[0]?.reason).toContain(
      "día anterior",
    );
  });
  it("sin comidas relacionadas vale si es después de la compra; con ids desconocidos se rechaza", () => {
    expect(run(task({ related_entry_ids: [] })).valid).toHaveLength(1);
    expect(run(task({ related_entry_ids: ["x"] })).rejected[0]?.reason).toContain(
      "no están en el plan",
    );
  });
  it("con varias comidas usa la primera y la más perecedera", () => {
    const t = task({ related_entry_ids: ["e1", "e2"], suggested_date: "2026-11-15" });
    expect(run(t).valid).toHaveLength(1); // primer uso 17: gap 2 ≤ min(3,2)=2
  });
});
