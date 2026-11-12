/**
 * Carga el catálogo (data/catalog/batches/*.json) en la base indicada por el entorno, como recetas públicas del
 * grupo del sistema "Catálogo". Es idempotente: no duplica (por grupo + título) y actualiza lo existente.
 *
 *   pnpm catalog:load                       # usa .env.local (base local)
 *   CATALOG_ENV_FILE=.env.prod pnpm catalog:load   # otra base (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { matchLocal, type CatalogIngredient } from "@/lib/domain/ingredient-match";
import { parseIngredientLine } from "@/lib/domain/ingredient-line";
import type { CatalogRecipe } from "./generate";

process.loadEnvFile(process.env.CATALOG_ENV_FILE ?? ".env.local");

const CATALOG_GROUP = "00000000-0000-4000-8000-00000000ca7a";
const DIR = path.join(process.cwd(), "data/catalog/batches");

const slugify = (title: string) => {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const hash = createHash("sha1").update(title).digest("hex").slice(0, 6);
  return `${base || "receta"}-${hash}`;
};

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
    },
  );
  const recipes: CatalogRecipe[] = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .flatMap((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) as CatalogRecipe[]);
  console.log(`${recipes.length} recetas a cargar en ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);

  const { data: cat } = await admin.from("ingredients").select("id, name, aliases");
  const catalog: CatalogIngredient[] = (cat ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    aliases: c.aliases ?? [],
  }));
  const { data: existing } = await admin
    .from("recipes")
    .select("id, title")
    .eq("group_id", CATALOG_GROUP);
  const byTitle = new Map((existing ?? []).map((r) => [r.title, r.id]));

  let created = 0;
  let updated = 0;
  let failed = 0;
  for (const r of recipes) {
    const total = r.prep_minutes + r.cook_minutes;
    const row = {
      group_id: CATALOG_GROUP,
      title: r.title,
      description: r.description,
      servings: r.servings,
      prep_minutes: r.prep_minutes,
      cook_minutes: r.cook_minutes,
      total_minutes: total,
      difficulty: r.difficulty,
      tags: r.tags,
      source_type: "ai_generated",
      status: "active",
      visibility: "public",
      is_catalog: true,
      slug: slugify(r.title),
      published_at: new Date().toISOString(),
      storage_info: {
        fridge_days: r.storage.fridge_days,
        freezer_days: r.storage.freezer_days,
        reheat: r.storage.reheat,
        tip: r.storage.tip,
      },
    };
    let id = byTitle.get(r.title);
    if (id) {
      await admin.from("recipes").update(row).eq("id", id);
      await admin.from("recipe_ingredients").delete().eq("recipe_id", id);
      await admin.from("recipe_steps").delete().eq("recipe_id", id);
      updated++;
    } else {
      const { data, error } = await admin.from("recipes").insert(row).select("id").single();
      if (error || !data) {
        failed++;
        console.log(`✗ ${r.title}: ${error?.message}`);
        continue;
      }
      id = data.id;
      byTitle.set(r.title, id);
      created++;
    }
    const ingredients = r.ingredients.map((raw, position) => {
      const p = parseIngredientLine(raw);
      return {
        recipe_id: id!,
        raw_text: raw,
        quantity: p.quantity,
        unit: p.unit,
        preparation: p.preparation,
        optional: p.optional,
        position,
        ingredient_id: matchLocal(p.name, catalog)?.id ?? null,
      };
    });
    const steps = r.steps.map((s, position) => ({
      recipe_id: id!,
      position,
      instruction: s.instruction,
      duration_seconds: s.minutes ? s.minutes * 60 : null,
      timer_kind: s.minutes ? (s.passive ? "passive" : "active") : null,
    }));
    const a = await admin.from("recipe_ingredients").insert(ingredients);
    const b = await admin.from("recipe_steps").insert(steps);
    if (a.error || b.error) {
      failed++;
      console.log(`✗ ${r.title}: ${a.error?.message ?? b.error?.message}`);
    }
  }
  console.log(`Creadas ${created}, actualizadas ${updated}, con error ${failed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
