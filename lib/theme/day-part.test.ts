import { describe, expect, it } from "vitest";
import { getDayPart, parseDayPartPreference, resolveDayPart } from "./day-part";

// Buenos Aires es UTC-3 todo el año (sin horario de verano).
const at = (hhmm: string) => new Date(`2026-11-11T${hhmm}:00-03:00`);

describe("getDayPart", () => {
  it.each([
    ["00:00", "noche"],
    ["05:59", "noche"],
    ["06:00", "mediodia"],
    ["12:30", "mediodia"],
    ["15:59", "mediodia"],
    ["16:00", "tarde"],
    ["19:59", "tarde"],
    ["20:00", "noche"],
    ["23:59", "noche"],
  ])("%s → %s", (time, expected) => {
    expect(getDayPart(at(time))).toBe(expected);
  });

  it("respeta la zona horaria indicada", () => {
    const date = new Date("2026-11-11T12:00:00Z");
    expect(getDayPart(date, "UTC")).toBe("mediodia");
    expect(getDayPart(date, "America/Argentina/Buenos_Aires")).toBe("mediodia"); // 09:00
    expect(getDayPart(date, "Asia/Tokyo")).toBe("noche"); // 21:00
  });
});

describe("parseDayPartPreference", () => {
  it("acepta valores válidos y cae a auto en el resto", () => {
    expect(parseDayPartPreference("noche")).toBe("noche");
    expect(parseDayPartPreference("auto")).toBe("auto");
    expect(parseDayPartPreference("otra")).toBe("auto");
    expect(parseDayPartPreference(undefined)).toBe("auto");
    expect(parseDayPartPreference(null)).toBe("auto");
  });
});

describe("resolveDayPart", () => {
  it("la preferencia manual gana sobre la hora", () => {
    expect(resolveDayPart("noche", at("12:00"))).toBe("noche");
  });
  it("en auto usa la hora", () => {
    expect(resolveDayPart("auto", at("17:00"))).toBe("tarde");
  });
});
