import { describe, expect, it } from "vitest";
import { isOwnAudioPath } from "./audio-path";

describe("isOwnAudioPath", () => {
  it("acepta un archivo dentro de la carpeta propia", () => {
    expect(isOwnAudioPath("u1/abc-123.webm", "u1")).toBe(true);
  });
  it("rechaza carpetas ajenas, subcarpetas y rutas raras", () => {
    expect(isOwnAudioPath("u2/abc.webm", "u1")).toBe(false);
    expect(isOwnAudioPath("u1/sub/abc.webm", "u1")).toBe(false);
    expect(isOwnAudioPath("u1/../u2/abc.webm", "u1")).toBe(false);
    expect(isOwnAudioPath("/u1/abc.webm", "u1")).toBe(false);
    expect(isOwnAudioPath("u1/", "u1")).toBe(false);
    expect(isOwnAudioPath("u1/a b.webm", "u1")).toBe(false);
  });
});
