import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/shopping/enrich", () => ({ enrichShoppingList: vi.fn() }));
vi.mock("@/lib/shopping/generate", () => ({ generateShoppingLists: vi.fn() }));

import type { StreamEvent } from "@/lib/ai/stream";
import { runFinalize, type FinalizeCtx, type FinalizeStep } from "./finalize";

const ctx = { listIds: [] } as unknown as FinalizeCtx;
const step = (name: string, critical: boolean, fail = false): FinalizeStep => ({
  name,
  label: name,
  critical,
  run: vi.fn(async () => {
    if (fail) throw new Error("boom");
  }),
});

describe("runFinalize", () => {
  it("corre todos los pasos y termina con done", async () => {
    const events: StreamEvent[] = [];
    const steps = [step("a", true), step("b", false)];
    const r = await runFinalize(ctx, (e) => events.push(e), steps);
    expect(r.failed).toEqual([]);
    expect(events.at(-1)).toEqual({ type: "done" });
    expect(events.filter((e) => e.type === "step" && e.status === "done")).toHaveLength(2);
  });

  it("un paso no crítico que falla no corta el resto", async () => {
    const events: StreamEvent[] = [];
    const steps = [step("a", true), step("b", false, true), step("c", false)];
    const r = await runFinalize(ctx, (e) => events.push(e), steps);
    expect(r.failed).toEqual(["b"]);
    expect(steps[2]!.run).toHaveBeenCalled();
    expect(events.at(-1)?.type).toBe("error");
  });

  it("un paso crítico que falla corta", async () => {
    const steps = [step("a", true, true), step("b", false)];
    const r = await runFinalize(ctx, () => {}, steps);
    expect(r.failed).toEqual(["a"]);
    expect(steps[1]!.run).not.toHaveBeenCalled();
  });

  it("reintentar solo los pasos pedidos", async () => {
    const steps = [step("a", true), step("b", false)];
    await runFinalize(ctx, () => {}, steps, ["b"]);
    expect(steps[0]!.run).not.toHaveBeenCalled();
    expect(steps[1]!.run).toHaveBeenCalled();
  });
});
