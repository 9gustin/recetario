import { describe, expect, it } from "vitest";
import { pickMimeType } from "./use-recorder";

describe("pickMimeType", () => {
  it("prefiere webm/opus", () => {
    expect(pickMimeType(() => true)).toBe("audio/webm;codecs=opus");
  });
  it("en iOS (solo mp4) usa mp4", () => {
    expect(pickMimeType((m) => m === "audio/mp4")).toBe("audio/mp4");
  });
  it("devuelve null si no hay formato soportado", () => {
    expect(pickMimeType(() => false)).toBeNull();
  });
});
