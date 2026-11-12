// Matcher local de ingredientes contra el catálogo (el fuzzy va por el RPC search_ingredients).

export type CatalogIngredient = { id: string; name: string; aliases: string[] };

/** Normaliza un nombre: minúsculas, sin acentos, singular simple y sin palabras de relleno. */
export function normalizeName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^(de|del|los|las|el|la|un|una|unos|unas)\s+/g, "")
    .replace(/\s+(fresco|fresca|picado|picada|molido|molida|seco|seca)\s*$/g, "")
    .trim();
}

/** Singular simple: "tomates"→"tomate", "cebollas"→"cebolla", "leches"→"leche". */
function singularize(word: string): string {
  return word.replace(/es$/, "e").replace(/s$/, "");
}

/** Clave de comparación: normalizado + singularizado. */
export function nameKey(raw: string): string {
  return singularize(normalizeName(raw));
}

/**
 * Busca por coincidencia exacta (nombre o alias) tras normalizar.
 * Devuelve null si no encuentra; el fuzzy (trigram) se resuelve en el servidor.
 */
export function matchLocal(name: string, catalog: CatalogIngredient[]): CatalogIngredient | null {
  const k = nameKey(name);
  if (!k) return null;

  for (const ing of catalog) {
    if (nameKey(ing.name) === k) return ing;
    if (ing.aliases.some((alias) => nameKey(alias) === k)) return ing;
  }
  return null;
}
