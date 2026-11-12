import { describe, expect, it } from "vitest";
import { encodeSse, parseSseBlock, type AssistantEvent } from "./events";

describe("SSE del asistente", () => {
  it("codifica y parsea un evento (ida y vuelta)", () => {
    const event: AssistantEvent = { type: "text_delta", text: "Hola, ¿cómo va?\nSegunda línea" };
    const encoded = encodeSse(event);
    expect(encoded.endsWith("\n\n")).toBe(true);
    expect(parseSseBlock(encoded.trim())).toEqual(event);
  });

  it("ignora bloques que no se entienden", () => {
    expect(parseSseBlock(": comentario")).toBeNull();
    expect(parseSseBlock("event: x\ndata: no-json")).toBeNull();
    expect(parseSseBlock('event: x\ndata: {"sin":"tipo"}')).toBeNull();
  });
});
