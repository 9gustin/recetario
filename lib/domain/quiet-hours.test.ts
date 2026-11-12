import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, hourAR, inQuietHours, shouldSend } from "./quiet-hours";

describe("quiet hours", () => {
  it("hora de Argentina", () => {
    expect(hourAR(new Date("2026-11-12T00:30:00Z"))).toBe(21);
  });
  it("rangos simples y que cruzan la medianoche", () => {
    expect(inQuietHours(10, 9, 12)).toBe(true);
    expect(inQuietHours(12, 9, 12)).toBe(false);
    expect(inQuietHours(23, 22, 8)).toBe(true);
    expect(inQuietHours(3, 22, 8)).toBe(true);
    expect(inQuietHours(12, 22, 8)).toBe(false);
    expect(inQuietHours(12, null, null)).toBe(false);
    expect(inQuietHours(12, 5, 5)).toBe(false);
  });
  it("shouldSend respeta tipo y horario; los timers siempre", () => {
    const quiet = { ...DEFAULT_PREFS, quiet_start: 22, quiet_end: 8 };
    const night = new Date("2026-11-12T03:00:00Z"); // 00 h AR
    expect(shouldSend("prep", quiet, night)).toBe(false);
    expect(shouldSend("timers", quiet, night)).toBe(true);
    expect(shouldSend("prep", { ...DEFAULT_PREFS, prep: false }, night)).toBe(false);
    expect(shouldSend("prep", DEFAULT_PREFS, night)).toBe(true);
  });
});
