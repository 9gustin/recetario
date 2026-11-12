// Formato legible de cantidades ("1 ½ tazas").

import { roundQuantity } from "./scale";

const KNOWN_FRACTIONS: [number, string][] = [
  [0.25, "¼"],
  [0.5, "½"],
  [0.75, "¾"],
];

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const whole = Math.floor(n);
  const frac = n - whole;
  for (const [f, char] of KNOWN_FRACTIONS) {
    if (Math.abs(frac - f) < 1e-9) return whole === 0 ? char : `${whole} ${char}`;
  }
  const dec = n.toFixed(2).replace(".", ",").replace(/,?0+$/, "");
  return whole === 0 ? dec : `${whole} ${dec}`;
}

function pluralizeUnit(unit: string): string {
  if (["g", "kg", "ml", "l", "cc"].includes(unit)) return unit;
  if (unit === "unidad") return "unidades";
  return `${unit}s`; // cda→cdas, cdita→cditas, taza→tazas, diente→dientes…
}

/** Formatea una cantidad con su unidad ("1 ½ tazas", "400 g"). */
export function formatQuantity(qty: number, unit: string | null): string {
  const rounded = roundQuantity(qty, unit);
  const num = formatNumber(rounded);
  if (!unit) return num;
  return `${num} ${rounded > 1 ? pluralizeUnit(unit) : unit}`;
}
