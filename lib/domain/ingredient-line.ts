// Parser de una línea de ingrediente en lenguaje natural.

import { normalizeUnit } from "./units";

export type ParsedIngredient = {
  quantity: number | null;
  unit: string | null;
  name: string;
  preparation: string | null;
  optional: boolean;
  /** "a gusto", "c/n", o el rango original ("2-3"). */
  note: string | null;
};

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 0.5,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 0.25,
  "¾": 0.75,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

function parseQuantityToken(token: string): number {
  const t = token.trim();
  if (UNICODE_FRACTIONS[t] !== undefined) return UNICODE_FRACTIONS[t]!;
  // mixto: "1 1/2" o "1 y 1/2"
  const mixed = t.match(/^(\d+)\s*(?:y|,)?\s*(\d+)\s*\/\s*(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  // fracción: "1/2"
  const frac = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  // decimal con coma o punto
  return Number(t.replace(",", "."));
}

const QTY =
  "½|⅓|⅔|¼|¾|⅛|⅜|⅝|⅞|\\d+\\s*(?:y|,)?\\s*\\d+\\s*/\\s*\\d+|\\d+\\s*/\\s*\\d+|\\d+(?:[.,]\\d+)?";

/** Parsea una línea tipo "200 g de pechuga de pollo, en cubos". */
export function parseIngredientLine(input: string): ParsedIngredient {
  let text = input.trim();
  let optional = false;
  let note: string | null = null;

  // "(opcional)"
  const opt = text.match(/^(.*?)\s*\(opcional\)$/i);
  if (opt) {
    optional = true;
    text = opt[1]!.trim();
  }

  // "a gusto" / "c/n" / "cantidad necesaria"
  const gusto = text.match(/^(.*?)\s+(?:a\s+gusto|c\/n|c\.n\.|cantidad\s+necesaria)$/i);
  if (gusto) {
    note = "a gusto";
    text = gusto[1]!.trim();
  }

  let quantity: number | null = null;
  let unit: string | null = null;

  // rango "2-3"
  const range = text.match(/^(\d+)\s*-\s*(\d+)\s*(.*)$/);
  if (range) {
    quantity = (Number(range[1]) + Number(range[2])) / 2;
    note = note ?? `${range[1]}-${range[2]}`;
    text = range[3]!.trim();
  } else {
    const q = text.match(new RegExp(`^(${QTY})\\s*(.*)$`));
    if (q) {
      quantity = parseQuantityToken(q[1]!);
      text = q[2]!.trim();
    }
  }

  // unidad (primera palabra) si es conocida
  const um = text.match(/^([^\s,]+)\s+(.*)$/);
  if (um) {
    const normalized = normalizeUnit(um[1]!);
    if (normalized) {
      unit = normalized;
      text = um[2]!.trim();
    }
  }

  // cantidad sin unidad explícita → "unidad" (conteo)
  if (quantity !== null && unit === null) unit = "unidad";

  // quitar relleno inicial
  text = text.replace(/^(de|del)\s+/i, "");

  // preparación después de la coma
  let name = text.trim();
  let preparation: string | null = null;
  const comma = text.indexOf(",");
  if (comma >= 0) {
    name = text.slice(0, comma).trim();
    preparation = text.slice(comma + 1).trim() || null;
  }

  return { quantity, unit, name, preparation, optional, note };
}
