import "server-only";
import { z } from "zod";
import { MODELS } from "@/lib/ai/models";
import { CATALOG_ENTRY_SYSTEM } from "@/lib/ai/prompts/parse-recipe";
import { runStructured } from "@/lib/ai/run-structured";
import { normalizeName } from "@/lib/domain/ingredient-match";
import { createAdminClient } from "@/lib/supabase/admin";

const AISLES = [
  "almacen",
  "verduleria",
  "especias",
  "carniceria",
  "lacteos",
  "congelados",
  "pescaderia",
  "fiambres",
] as const;

const entriesSchema = z.object({
  entries: z.array(
    z.object({
      source_name: z.string().max(120),
      name: z.string().min(1).max(120),
      aliases: z.array(z.string().max(80)).max(4),
      family: z.array(z.string().max(40)).max(3),
      aisle: z.enum(AISLES).nullable(),
      default_unit: z.string().max(20).nullable(),
      storage_tips: z.string().max(200).nullable(),
    }),
  ),
});

/** Máximo de fichas nuevas por importación (controla el costo y evita llenar el catálogo de basura). */
export const MAX_NEW_ENTRIES = 15;

/** Un nombre de ingrediente razonable: corto, sin números ni restos de HTML (evita ensuciar el catálogo). */
export function isReasonableIngredientName(name: string): boolean {
  const trimmed = name.trim();
  return (
    trimmed.length >= 2 &&
    trimmed.length <= 60 &&
    trimmed.split(/\s+/).length <= 4 &&
    !/[\d&<>{}[\]]/.test(trimmed)
  );
}

/**
 * Crea fichas de catálogo (`created_by_ai = true`, `reviewed = false`) para ingredientes que no
 * matchean. Devuelve un mapa nombre-normalizado → id. Usa el cliente admin: el catálogo solo se
 * escribe desde el servidor.
 */
export async function createCatalogEntries(
  names: string[],
  ctx: { userId: string; groupId: string },
): Promise<Map<string, string>> {
  const unique = [...new Map(names.map((n) => [normalizeName(n), n.trim()])).values()].slice(
    0,
    MAX_NEW_ENTRIES,
  );
  const result = new Map<string, string>();
  if (unique.length === 0) return result;

  const run = await runStructured({
    feature: "catalog_entry",
    model: MODELS.fast,
    system: CATALOG_ENTRY_SYSTEM,
    content: `Ingredientes nuevos:\n${unique.map((n) => `- ${n}`).join("\n")}`,
    schema: entriesSchema,
    userId: ctx.userId,
    groupId: ctx.groupId,
    maxTokens: 2000,
  });
  if (!run.ok) return result;

  const admin = createAdminClient();
  for (const entry of run.data.entries) {
    const name = entry.name.trim().toLowerCase();
    if (!name) continue;
    // Si ya existe (carrera con otra importación), se reutiliza.
    await admin.from("ingredients").upsert(
      {
        name,
        aliases: entry.aliases,
        family: entry.family,
        aisle: entry.aisle,
        default_unit: entry.default_unit,
        storage_tips: entry.storage_tips,
        created_by_ai: true,
        reviewed: false,
      },
      { onConflict: "name", ignoreDuplicates: true },
    );
    const { data } = await admin.from("ingredients").select("id").eq("name", name).maybeSingle();
    if (data) result.set(normalizeName(entry.source_name), data.id);
  }
  return result;
}
