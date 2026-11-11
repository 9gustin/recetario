export const DAY_PARTS = ["mediodia", "tarde", "noche"] as const;
export type DayPart = (typeof DAY_PARTS)[number];

export const DAY_PART_PREFERENCES = ["auto", ...DAY_PARTS] as const;
export type DayPartPreference = (typeof DAY_PART_PREFERENCES)[number];

export const DEFAULT_TIMEZONE = "America/Argentina/Buenos_Aires";
export const DAY_PART_COOKIE = "daypart";

/** Debe coincidir con `--background` de cada tema en app/globals.css (se usa en <meta name="theme-color">). */
export const THEME_COLORS: Record<DayPart, string> = {
  mediodia: "#f8efe2",
  tarde: "#22140f",
  noche: "#191411",
};

function getHour(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    hourCycle: "h23",
    timeZone,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  return hour === 24 ? 0 : hour;
}

/** mediodia: 6–16 h · tarde: 16–20 h · noche: 20–6 h (hora de Argentina por defecto). */
export function getDayPart(date: Date = new Date(), tz: string = DEFAULT_TIMEZONE): DayPart {
  const hour = getHour(date, tz);
  if (hour >= 20 || hour < 6) return "noche";
  if (hour < 16) return "mediodia";
  return "tarde";
}

export function parseDayPartPreference(value: string | null | undefined): DayPartPreference {
  return (DAY_PART_PREFERENCES as readonly string[]).includes(value ?? "")
    ? (value as DayPartPreference)
    : "auto";
}

export function resolveDayPart(
  preference: DayPartPreference,
  date: Date = new Date(),
  tz: string = DEFAULT_TIMEZONE,
): DayPart {
  return preference === "auto" ? getDayPart(date, tz) : preference;
}
