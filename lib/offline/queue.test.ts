import { describe, expect, it } from "vitest";
import { compact } from "./queue";

describe("compact", () => {
  it("deja solo el último cambio por ítem", () => {
    const out = compact([
      { id: "a", state: "bought", at: 2 },
      { id: "a", state: "pending", at: 3 },
      { id: "b", state: "have_it", at: 1 },
    ]);
    expect(out).toEqual([
      { id: "b", state: "have_it", at: 1 },
      { id: "a", state: "pending", at: 3 },
    ]);
  });
  it("cola vacía", () => {
    expect(compact([])).toEqual([]);
  });
});
