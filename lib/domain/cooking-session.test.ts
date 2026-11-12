import { describe, expect, it } from "vitest";
import { isResumable, resumeInit, type OpenSession } from "./cooking-session";

const NOW = new Date("2026-11-12T12:00:00Z").getTime();
const session = (over: Partial<OpenSession> = {}): OpenSession => ({
  id: "s1",
  current_step: 3,
  servings: 4,
  started_at: "2026-11-12T10:00:00Z",
  finished_at: null,
  pending_edits: [],
  ...over,
});

describe("isResumable", () => {
  it("retoma una sesión reciente a mitad de camino", () => {
    expect(isResumable(session(), 7, NOW)).toBe(true);
  });
  it("no retoma una sesión terminada", () => {
    expect(isResumable(session({ finished_at: "2026-11-12T11:00:00Z" }), 7, NOW)).toBe(false);
  });
  it("no retoma una sesión de más de 12 h", () => {
    expect(isResumable(session({ started_at: "2026-11-11T23:59:00Z" }), 7, NOW)).toBe(false);
    expect(isResumable(session({ started_at: "2026-11-12T00:00:01Z" }), 7, NOW)).toBe(true);
  });
  it("no retoma si no salió de la mise en place ni si ya llegó al final", () => {
    expect(isResumable(session({ current_step: 0 }), 7, NOW)).toBe(false);
    expect(isResumable(session({ current_step: 6 }), 7, NOW)).toBe(false);
  });
});

describe("resumeInit", () => {
  it("vuelve al mismo paso con las mismas porciones y marca los anteriores", () => {
    const init = resumeInit(session({ current_step: 4 }), 5);
    expect(init.index).toBe(4);
    expect(init.servings).toBe(4);
    expect(init.completed).toEqual([0, 1, 2, 3]);
  });
  it("acota el paso a la cantidad de pasos de la receta", () => {
    expect(resumeInit(session({ current_step: 99 }), 5).index).toBe(5);
  });
});
