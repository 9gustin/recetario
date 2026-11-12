import { describe, expect, it } from "vitest";
import { pickSpanishVoice } from "./use-speak";

describe("pickSpanishVoice", () => {
  it("prefiere es-AR", () => {
    expect(pickSpanishVoice([{ lang: "en-US" }, { lang: "es-ES" }, { lang: "es-AR" }])).toBe(2);
    expect(pickSpanishVoice([{ lang: "es_AR" }])).toBe(0);
  });
  it("si no hay es-AR, usa cualquier es-*", () => {
    expect(pickSpanishVoice([{ lang: "en-US" }, { lang: "es-MX" }])).toBe(1);
  });
  it("devuelve -1 si no hay voz en español", () => {
    expect(pickSpanishVoice([{ lang: "en-US" }, { lang: "pt-BR" }])).toBe(-1);
    expect(pickSpanishVoice([])).toBe(-1);
  });
});
