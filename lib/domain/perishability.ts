/** Días de sobras que consideramos seguros en heladera. */
export const LEFTOVER_MAX_DAYS = 3;

/** ¿Un ingrediente con esa vida útil en heladera ya no estaría bien al usarlo `daysUntilUse` días después de comprarlo? */
export function isPerishableLate(
  shelfLifeFridgeDays: number | null | undefined,
  daysUntilUse: number,
): boolean {
  if (shelfLifeFridgeDays === null || shelfLifeFridgeDays === undefined) return false;
  return shelfLifeFridgeDays < daysUntilUse;
}

/** ¿Las sobras se comen demasiado tarde después de cocinadas? */
export function leftoversExpired(
  cookedOn: string,
  eatenOn: string,
  daysBetween: (a: string, b: string) => number,
): boolean {
  return daysBetween(cookedOn, eatenOn) > LEFTOVER_MAX_DAYS;
}
