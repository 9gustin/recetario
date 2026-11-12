/** Semanas y fechas del plan. Se trabaja con strings "YYYY-MM-DD" en hora de Argentina (sin horario de verano). */

export const DEFAULT_TIMEZONE = "America/Argentina/Buenos_Aires";

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const toUtc = (dateStr: string) => new Date(`${dateStr}T00:00:00Z`);
const fromUtc = (d: Date) => d.toISOString().slice(0, 10);

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria indicada. */
export function todayString(now: Date = new Date(), tz: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
}

export function addDays(dateStr: string, days: number): string {
  const d = toUtc(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** Día de la semana (0 = domingo … 6 = sábado). */
export function dayOfWeek(dateStr: string): number {
  return toUtc(dateStr).getUTCDay();
}

/** Primer día de la semana (YYYY-MM-DD) que contiene `date`. `weekStartsOn`: 0 = domingo, 1 = lunes. */
export function weekStartOf(
  date: Date | string,
  weekStartsOn = 1,
  tz: string = DEFAULT_TIMEZONE,
): string {
  const day = typeof date === "string" ? date : todayString(date, tz);
  const diff = (dayOfWeek(day) - weekStartsOn + 7) % 7;
  return addDays(day, -diff);
}

/** Los siete días de la semana, en orden. */
export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** "Semana del 17 al 23 de noviembre" (o "del 30 de noviembre al 6 de diciembre" si cruza de mes). */
export function formatWeekLabel(weekStart: string): string {
  const end = addDays(weekStart, 6);
  const [, sm, sd] = weekStart.split("-").map(Number);
  const [, em, ed] = end.split("-").map(Number);
  return sm === em
    ? `Semana del ${sd} al ${ed} de ${MONTHS[em! - 1]}`
    : `Semana del ${sd} de ${MONTHS[sm! - 1]} al ${ed} de ${MONTHS[em! - 1]}`;
}

/** "Lunes 17" */
export function dayLabel(dateStr: string): string {
  return `${WEEKDAYS[dayOfWeek(dateStr)]} ${Number(dateStr.slice(8, 10))}`;
}

/** Días entre dos fechas (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);
}
