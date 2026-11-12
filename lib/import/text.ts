/** Extracción de texto de HTML sin DOM (rápida y suficiente para pasárselo a la IA). */

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
  frac13: "⅓",
  frac23: "⅔",
  frac18: "⅛",
  deg: "°",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  times: "×",
  reg: "®",
  copy: "©",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  bull: "•",
  middot: "·",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  ntilde: "ñ",
  uuml: "ü",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  Ntilde: "Ñ",
  agrave: "à",
  egrave: "è",
  ccedil: "ç",
  iexcl: "¡",
  iquest: "¿",
};

export function decodeEntities(text: string): string {
  return text
    .replace(/&([A-Za-z][A-Za-z0-9]*);/g, (m, name: string) => NAMED[name] ?? m)
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)));
}

/** Saca las etiquetas y deja el texto con espacios normalizados. */
export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

/** Idioma declarado en `<html lang="…">` (null si no lo dice). */
export function pageLanguage(html: string): string | null {
  return html.match(/<html[^>]*\slang=["']?([A-Za-z]{2,3})/i)?.[1]?.toLowerCase() ?? null;
}

export const MAX_PAGE_TEXT = 15_000;

/** Texto principal de la página (sin scripts, menús ni pie) y truncado a ~15k caracteres. */
export function extractMainText(html: string, maxChars = MAX_PAGE_TEXT): string {
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  const cleaned = body
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(
      /<(script|style|noscript|svg|nav|footer|header|aside|form|iframe|template)\b[\s\S]*?<\/\1>/gi,
      " ",
    );
  // Se prefiere <main> o <article> si existen.
  const focus = cleaned.match(/<(main|article)\b[^>]*>([\s\S]*?)<\/\1>/i)?.[2] ?? cleaned;
  return stripTags(focus.replace(/<\/(p|div|li|h[1-6]|tr|section)>/gi, "\n"))
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, maxChars);
}
