// Unidades canónicas del recetario, con sinónimos y conversión dentro de la misma dimensión.

export type Dimension = "mass" | "volume" | "count";

type UnitDef = { name: string; dimension: Dimension; factor: number };

const UNITS: Record<string, UnitDef> = {
  g: { name: "g", dimension: "mass", factor: 1 },
  kg: { name: "kg", dimension: "mass", factor: 1000 },
  ml: { name: "ml", dimension: "volume", factor: 1 },
  l: { name: "l", dimension: "volume", factor: 1000 },
  cc: { name: "cc", dimension: "volume", factor: 1 },
  cda: { name: "cda", dimension: "volume", factor: 15 },
  cdita: { name: "cdita", dimension: "volume", factor: 5 },
  taza: { name: "taza", dimension: "volume", factor: 240 },
  unidad: { name: "unidad", dimension: "count", factor: 1 },
  pizca: { name: "pizca", dimension: "count", factor: 1 },
  diente: { name: "diente", dimension: "count", factor: 1 },
  atado: { name: "atado", dimension: "count", factor: 1 },
  lata: { name: "lata", dimension: "count", factor: 1 },
  paquete: { name: "paquete", dimension: "count", factor: 1 },
  feta: { name: "feta", dimension: "count", factor: 1 },
  rodaja: { name: "rodaja", dimension: "count", factor: 1 },
};

const SYNONYMS: Record<string, string> = {
  gr: "g",
  grs: "g",
  gramo: "g",
  gramos: "g",
  kgs: "kg",
  kilo: "kg",
  kilos: "kg",
  kilogramo: "kg",
  kilogramos: "kg",
  mililitro: "ml",
  mililitros: "ml",
  cm3: "cc",
  lt: "l",
  litro: "l",
  litros: "l",
  cdas: "cda",
  cucharada: "cda",
  cucharadas: "cda",
  "cucharada sopera": "cda",
  "cucharadas soperas": "cda",
  "cuch.": "cda",
  cuch: "cda",
  cucharadita: "cdita",
  cucharaditas: "cdita",
  cditas: "cdita",
  cucharita: "cdita",
  cucharitas: "cdita",
  cdta: "cdita",
  cdtas: "cdita",
  tazas: "taza",
  unidades: "unidad",
  "un.": "unidad",
  un: "unidad",
  pizcas: "pizca",
  dientes: "diente",
  atados: "atado",
  latas: "lata",
  paquetes: "paquete",
  paq: "paquete",
  fetas: "feta",
  rodajas: "rodaja",
};

/** Devuelve la unidad canónica (o null si no la reconoce). */
export function normalizeUnit(raw: string): string | null {
  const key = raw.trim().toLowerCase().replace(/\.$/, "");
  if (UNITS[key]) return key;
  return SYNONYMS[key] ?? null;
}

/** Dimensión de una unidad canónica (o null si no la reconoce). */
export function dimensionOf(unit: string): Dimension | null {
  return UNITS[unit]?.dimension ?? null;
}

/**
 * Convierte una cantidad entre unidades de la misma dimensión.
 * Devuelve null si las dimensiones no coinciden (o la unidad es desconocida).
 */
export function convert(qty: number, from: string, to: string): number | null {
  const f = UNITS[from];
  const t = UNITS[to];
  if (!f || !t || f.dimension !== t.dimension) return null;
  if (f.dimension === "count") return qty;
  return (qty * f.factor) / t.factor;
}

/** Lleva una cantidad a la unidad base de su dimensión (g para masa, ml para volumen). */
export function toBase(qty: number, unit: string): { qty: number; unit: string } | null {
  const u = UNITS[unit];
  if (!u) return null;
  if (u.dimension === "count") return { qty, unit };
  return { qty: qty * u.factor, unit: u.dimension === "mass" ? "g" : "ml" };
}
