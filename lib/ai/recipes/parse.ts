import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { createCatalogEntries } from "@/lib/ai/ingredients/create-entry";
import { MODELS } from "@/lib/ai/models";
import { PARSE_RECIPE_SYSTEM, STEP_TIMING_SYSTEM } from "@/lib/ai/prompts/parse-recipe";
import { runStructured } from "@/lib/ai/run-structured";
import { matchLocal, normalizeName, type CatalogIngredient } from "@/lib/domain/ingredient-match";
import { fetchUrl } from "@/lib/import/fetch-url";
import { extractJsonLdRecipe } from "@/lib/import/json-ld";
import { extractMainText, pageLanguage } from "@/lib/import/text";
import { aiRecipeOutputSchema, aiRecipeToDraft, stepTimingSchema } from "@/lib/schemas/ai-recipe";
import type { RecipeDraft } from "@/lib/schemas/recipe";
import { createClient } from "@/lib/supabase/server";

export type ParseSource =
  | { kind: "text"; text: string }
  | { kind: "url"; url: string }
  | { kind: "image"; paths: string[] }
  | { kind: "voice"; transcript: string };

export type ParseErrorCode =
  "not_a_recipe" | "fetch_failed" | "ai_failed" | "bad_image" | "too_short";

export type ParseResult =
  | { ok: true; data: { draft: RecipeDraft; newIngredients: string[]; via: "json-ld" | "ai" } }
  | { ok: false; error: string; code: ParseErrorCode };

type Ctx = { userId: string; groupId: string };

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MIN_TEXT = 20;

const fail = (code: ParseErrorCode, error: string): ParseResult => ({ ok: false, code, error });

async function structure(
  content: string | Anthropic.Messages.ContentBlockParam[],
  model: typeof MODELS.fast | typeof MODELS.smart,
  ctx: Ctx,
  sourceUrl?: string | null,
): Promise<ParseResult> {
  const run = await runStructured({
    feature: "parse_recipe",
    model,
    system: PARSE_RECIPE_SYSTEM,
    content,
    schema: aiRecipeOutputSchema,
    userId: ctx.userId,
    groupId: ctx.groupId,
    toolName: "guardar_receta",
    toolDescription: "Guarda la receta estructurada.",
    maxTokens: 6000,
  });
  if (!run.ok) return fail("ai_failed", run.error);
  const out = run.data;
  if (!out.is_recipe || out.ingredients.length === 0 || out.steps.length === 0) {
    return fail("not_a_recipe", "No encontramos una receta en ese contenido.");
  }
  return {
    ok: true,
    data: { draft: aiRecipeToDraft(out, sourceUrl), newIngredients: [], via: "ai" },
  };
}

/** Receta que ya venía estructurada (JSON-LD): la IA solo estima duración y tipo de cada paso. */
async function enrichStepTiming(draft: RecipeDraft, ctx: Ctx): Promise<RecipeDraft> {
  const steps = draft.steps ?? [];
  if (steps.length === 0) return draft;
  const run = await runStructured({
    feature: "parse_recipe",
    model: MODELS.fast,
    system: STEP_TIMING_SYSTEM,
    content: steps.map((s, i) => `${i + 1}. ${s.instruction}`).join("\n"),
    schema: stepTimingSchema,
    userId: ctx.userId,
    groupId: ctx.groupId,
    maxTokens: 1500,
  });
  if (!run.ok || run.data.steps.length !== steps.length) return draft; // no es crítico
  return {
    ...draft,
    steps: steps.map((s, i) => ({
      ...s,
      ...run.data.steps[i],
      tip: run.data.steps[i]?.tip ?? s.tip,
    })),
  };
}

/** Baja las fotos de `<grupo>/imports/` y las pasa como bloques de imagen. */
async function imageBlocks(
  paths: string[],
  groupId: string,
): Promise<
  { ok: true; blocks: Anthropic.Messages.ContentBlockParam[] } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const blocks: Anthropic.Messages.ContentBlockParam[] = [];
  for (const path of paths) {
    if (!path.startsWith(`${groupId}/imports/`) || path.includes("..")) {
      return { ok: false, error: "Foto inválida." };
    }
    const { data: blob, error } = await supabase.storage.from("recipe-images").download(path);
    if (error || !blob)
      return { ok: false, error: "No pudimos leer la foto. Probá subirla de nuevo." };
    const type = (blob.type || "image/jpeg").toLowerCase();
    if (!(IMAGE_TYPES as readonly string[]).includes(type)) {
      return {
        ok: false,
        error: "El formato de la foto no es compatible. Probá con una foto JPG o PNG.",
      };
    }
    if (blob.size > MAX_IMAGE_BYTES)
      return { ok: false, error: "Una de las fotos pesa más de 5 MB." };
    blocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: type as (typeof IMAGE_TYPES)[number],
        data: Buffer.from(await blob.arrayBuffer()).toString("base64"),
      },
    });
  }
  return { ok: true, blocks };
}

/** Vincula cada ingrediente con el catálogo (exacto → alias → trigram → ficha nueva por IA). */
export async function linkIngredients(
  draft: RecipeDraft,
  ctx: Ctx,
): Promise<{ draft: RecipeDraft; newIngredients: string[] }> {
  const ingredients = draft.ingredients ?? [];
  if (ingredients.length === 0) return { draft, newIngredients: [] };

  const supabase = await createClient();
  const { data: rows } = await supabase.from("ingredients").select("id, name, aliases");
  const catalog: CatalogIngredient[] = (rows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    aliases: r.aliases ?? [],
  }));

  const ids = new Map<number, string>();
  const unmatched = new Map<string, string>(); // nombre normalizado → nombre
  for (const [i, ing] of ingredients.entries()) {
    const name = (ing.name_canonical ?? "").trim();
    if (!name) continue;
    const local = matchLocal(name, catalog);
    if (local) {
      ids.set(i, local.id);
      continue;
    }
    const { data: fuzzy } = await supabase.rpc("search_ingredients", { q: name, lim: 1 });
    const best = fuzzy?.[0];
    if (best && best.similarity >= 0.5) ids.set(i, best.id);
    else unmatched.set(normalizeName(name), name);
  }

  const created = await createCatalogEntries([...unmatched.values()], ctx);
  const newNames: string[] = [];
  const linked = ingredients.map((ing, i) => {
    const existing = ids.get(i);
    if (existing) return { ...ing, ingredient_id: existing };
    const name = (ing.name_canonical ?? "").trim();
    const createdId = name ? created.get(normalizeName(name)) : undefined;
    if (createdId) {
      newNames.push(name);
      return { ...ing, ingredient_id: createdId };
    }
    return ing;
  });
  return { draft: { ...draft, ingredients: linked }, newIngredients: [...new Set(newNames)] };
}

/** Convierte texto, un link, fotos o un dictado en un borrador de receta (no guarda nada). */
export async function parseRecipe(source: ParseSource, ctx: Ctx): Promise<ParseResult> {
  let result: ParseResult;

  if (source.kind === "text" || source.kind === "voice") {
    const text = source.kind === "text" ? source.text : source.transcript;
    if (text.trim().length < MIN_TEXT)
      return fail("too_short", "Escribí o dictá un poco más para poder armar la receta.");
    result = await structure(text, MODELS.fast, ctx);
  } else if (source.kind === "url") {
    const page = await fetchUrl(source.url);
    if (!page.ok) return fail("fetch_failed", page.error);
    const fromJsonLd = extractJsonLdRecipe(page.html, page.finalUrl);
    const lang = pageLanguage(page.html);
    if (fromJsonLd && lang && lang !== "es") {
      // Receta estructurada pero en otro idioma: la IA la traduce y normaliza (el parser de líneas es para español).
      result = await structure(
        `Receta de ${page.finalUrl} (en otro idioma; traducila al español rioplatense y convertí las medidas a g, ml, cda, cdita y taza):\n${JSON.stringify(fromJsonLd)}`,
        MODELS.fast,
        ctx,
        page.finalUrl,
      );
    } else if (fromJsonLd) {
      result = {
        ok: true,
        data: {
          draft: await enrichStepTiming(fromJsonLd, ctx),
          newIngredients: [],
          via: "json-ld",
        },
      };
    } else {
      const text = extractMainText(page.html);
      if (text.length < 100)
        return fail("not_a_recipe", "No encontramos una receta en esa página.");
      result = await structure(
        `Página: ${page.finalUrl}\n\n${text}`,
        MODELS.fast,
        ctx,
        page.finalUrl,
      );
    }
  } else {
    const images = await imageBlocks(source.paths, ctx.groupId);
    if (!images.ok) return fail("bad_image", images.error);
    result = await structure(
      [
        ...images.blocks,
        {
          type: "text",
          text: "Estructurá la receta que aparece en estas fotos, en el orden en que se ven.",
        },
      ],
      MODELS.smart,
      ctx,
    );
  }

  if (!result.ok) return result;
  const linked = await linkIngredients(result.data.draft, ctx);
  return {
    ok: true,
    data: { draft: linked.draft, newIngredients: linked.newIngredients, via: result.data.via },
  };
}
