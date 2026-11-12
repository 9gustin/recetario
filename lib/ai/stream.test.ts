import { describe, expect, it } from "vitest";
import { encodeEvent, parseEventBlock, sseResponse } from "./stream";

describe("stream helper", () => {
  it("codifica y parsea eventos", () => {
    const block = encodeEvent({ type: "step", name: "lista", status: "done" }).trim();
    expect(parseEventBlock(block)).toEqual({ type: "step", name: "lista", status: "done" });
    expect(parseEventBlock("event: x")).toBeNull();
    expect(parseEventBlock("data: no-json")).toBeNull();
    expect(parseEventBlock('data: {"a":1}')).toBeNull();
  });

  it("sseResponse emite los eventos y un error si run falla", async () => {
    const ok = await sseResponse(async (emit) => emit({ type: "done" })).text();
    expect(ok).toContain("event: done");
    const bad = await sseResponse(async () => {
      throw new Error("x");
    }).text();
    expect(bad).toContain("event: error");
  });
});
