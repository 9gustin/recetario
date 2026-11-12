import { parseIngredientLine } from "@/lib/domain/ingredient-line";
import { recipeDraftSchema, type RecipeDraft } from "@/lib/schemas/recipe";
import { decodeEntities, stripTags } from "./text";

/** "PT1H30M" → 90 (minutos, redondeando hacia arriba). null si no se entiende. */
export function parseIsoDuration(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (!m) return null;
  const [, d, h, min, s] = m;
  const total =
    Number(d ?? 0) * 1440 + Number(h ?? 0) * 60 + Number(min ?? 0) + Number(s ?? 0) / 60;
  return total > 0 ? Math.ceil(total) : null;
}

type Json = unknown;
const asArray = (v: Json): Json[] =>
  Array.isArray(v) ? v : v === undefined || v === null ? [] : [v];
const isObject = (v: Json): v is Record<string, Json> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function isRecipeNode(node: Json): node is Record<string, Json> {
  if (!isObject(node)) return false;
  return asArray(node["@type"]).some((t) => typeof t === "string" && /(^|\/)Recipe$/i.test(t));
}

/** Busca el nodo Recipe en el JSON-LD (suelto, en arrays o dentro de `@graph`). */
function findRecipeNode(data: Json): Record<string, Json> | null {
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }
  if (!isObject(data)) return null;
  if (isRecipeNode(data)) return data;
  return findRecipeNode(data["@graph"]);
}

function imageUrl(image: Json): string | null {
  for (const item of asArray(image)) {
    if (typeof item === "string") return item;
    if (isObject(item) && typeof item.url === "string") return item.url;
  }
  return null;
}

function servingsFrom(yieldValue: Json): number | null {
  for (const item of asArray(yieldValue)) {
    const match = String(item).match(/\d+(?:[.,]\d+)?/);
    if (match) {
      const n = Number(match[0].replace(",", "."));
      if (n > 0) return n;
    }
  }
  return null;
}

function instructionTexts(value: Json): string[] {
  const out: string[] = [];
  for (const item of asArray(value)) {
    if (typeof item === "string") {
      // Un solo bloque con saltos de línea o numeración → un paso por línea.
      const parts = stripTags(item)
        .split(/\n+/)
        .map((p) => p.replace(/^\s*\d+[.)-]\s*/, "").trim());
      out.push(...parts.filter(Boolean));
    } else if (isObject(item)) {
      if (item.itemListElement)
        out.push(...instructionTexts(item.itemListElement)); // HowToSection
      else if (typeof item.text === "string") out.push(stripTags(item.text));
      else if (typeof item.name === "string") out.push(stripTags(item.name));
    }
  }
  return out.filter(Boolean);
}

/** Mapea el JSON-LD `schema.org/Recipe` de una página a un borrador de receta. null si no hay. */
export function extractJsonLdRecipe(html: string, sourceUrl?: string): RecipeDraft | null {
  const blocks = [
    ...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ];
  for (const [, raw] of blocks) {
    let data: Json;
    try {
      data = JSON.parse(decodeEntities((raw ?? "").trim()));
    } catch {
      continue;
    }
    const node = findRecipeNode(data);
    if (!node) continue;

    const ingredients = asArray(node.recipeIngredient)
      .filter((i): i is string => typeof i === "string" && i.trim() !== "")
      .map((line, position) => {
        const text = stripTags(line);
        const parsed = parseIngredientLine(text);
        return {
          raw_text: text.slice(0, 200),
          quantity: parsed.quantity,
          unit: parsed.unit,
          preparation: parsed.preparation,
          section: null,
          optional: parsed.optional,
          position,
          ingredient_id: null,
          name_canonical: parsed.name || undefined,
        };
      });

    const steps = instructionTexts(node.recipeInstructions).map((text, position) => ({
      position,
      instruction: text.slice(0, 2000),
      duration_seconds: null,
      timer_kind: null,
      tip: null,
      ingredient_ids: [] as string[],
    }));

    const tags = [
      ...asArray(node.recipeCategory),
      ...(typeof node.keywords === "string" ? node.keywords.split(",") : asArray(node.keywords)),
    ]
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 10);

    const draft = recipeDraftSchema.safeParse({
      title: typeof node.name === "string" ? stripTags(node.name).slice(0, 120) : undefined,
      description:
        typeof node.description === "string"
          ? stripTags(node.description).slice(0, 2000)
          : undefined,
      image_url: imageUrl(node.image),
      source_url: sourceUrl ?? null,
      servings: servingsFrom(node.recipeYield) ?? undefined,
      prep_minutes: parseIsoDuration(node.prepTime),
      cook_minutes: parseIsoDuration(node.cookTime),
      total_minutes: parseIsoDuration(node.totalTime),
      tags,
      ingredients,
      steps,
    });
    if (draft.success && (draft.data.ingredients?.length || draft.data.steps?.length))
      return draft.data;
  }
  return null;
}
