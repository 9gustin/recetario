import { normalizeName } from "./ingredient-match";

type Titled = { title: string };

/** Filtra por lo que se escribe después de "@": sin acentos ni mayúsculas, empezando por las que arrancan igual. */
export function filterMentionCandidates<T extends Titled>(all: T[], query: string, limit = 6): T[] {
  const q = normalizeName(query.replace(/^@/, ""));
  if (!q) return all.slice(0, limit);
  const key = (title: string) =>
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const qk = key(query.replace(/^@/, "")).trim();
  const starts: T[] = [];
  const contains: T[] = [];
  for (const item of all) {
    const k = key(item.title);
    if (k.startsWith(qk)) starts.push(item);
    else if (k.includes(qk)) contains.push(item);
  }
  return [...starts, ...contains].slice(0, limit);
}
