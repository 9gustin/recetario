// Escalado de cantidades por porciones y redondeo amigable.

import { dimensionOf } from "./units";

/** Escala una cantidad de `from` a `to` porciones (valor exacto, sin redondear). */
export function scaleQuantity(qty: number, from: number, to: number): number {
  if (from <= 0) return qty;
  return (qty * to) / from;
}

/**
 * Redondeo "amigable" para mostrar: unidades enteras o medias, gramos a 5/10,
 * cucharadas a 1/2, y así.
 */
export function roundQuantity(qty: number, unit: string | null): number {
  if (qty === 0) return 0;
  const dim = dimensionOf(unit ?? "unidad");

  if (dim === "mass") {
    if (qty >= 100) return Math.round(qty / 10) * 10;
    if (qty >= 20) return Math.round(qty / 5) * 5;
    if (qty >= 1) return Math.round(qty);
    return Math.round(qty * 2) / 2;
  }

  if (dim === "volume") {
    if (unit === "cda" || unit === "cdita") return Math.round(qty * 2) / 2;
    if (qty >= 10) return Math.round(qty);
    return Math.round(qty * 4) / 4;
  }

  // conteo: enteros o medios (cuartos para cantidades chicas)
  if (qty >= 1) return Math.round(qty * 2) / 2;
  return Math.round(qty * 4) / 4;
}
