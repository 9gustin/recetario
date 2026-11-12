import { DEFAULT_TIMEZONE } from "./week";

/** Hora (0–23) en Argentina. */
export function hourAR(now: Date, tz: string = DEFAULT_TIMEZONE): number {
  return (
    Number(
      new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(
        now,
      ),
    ) % 24
  );
}

/** ¿Estamos dentro del horario silencioso? Admite rangos que cruzan la medianoche (22 → 8). */
export function inQuietHours(hour: number, start: number | null, end: number | null): boolean {
  if (start === null || end === null || start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

export type PushKind = "prep" | "thaw" | "timers" | "inbox";
export type Prefs = {
  prep: boolean;
  thaw: boolean;
  timers: boolean;
  inbox: boolean;
  quiet_start: number | null;
  quiet_end: number | null;
};

export const DEFAULT_PREFS: Prefs = {
  prep: true,
  thaw: true,
  timers: true,
  inbox: true,
  quiet_start: null,
  quiet_end: null,
};

/** Decide si se manda ahora: tipo activado y fuera del horario silencioso (los timers se mandan siempre: son inmediatos). */
export function shouldSend(kind: PushKind, prefs: Prefs, now: Date): boolean {
  if (!prefs[kind]) return false;
  if (kind === "timers") return true;
  return !inQuietHours(hourAR(now), prefs.quiet_start, prefs.quiet_end);
}
