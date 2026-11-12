import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { MODELS } from "@/lib/ai/models";
import { runStructured } from "@/lib/ai/run-structured";
import type { Database } from "@/lib/supabase/database.types";

export const storageInfoSchema = z.object({
  fridge_days: z.number().int().min(0).max(14),
  freezer_days: z.number().int().min(0).max(365).nullable(),
  reheat: z.string().max(200),
  tip: z.string().max(200).nullable(),
});
export type StorageInfo = z.infer<typeof storageInfoSchema>;

const SYSTEM = `Sos un asistente de seguridad alimentaria para una app familiar argentina. Dada una receta cocinada, decí cuánto dura en la heladera (fridge_days, de forma CONSERVADORA: comidas cocidas 3 a 4 días como máximo), si se puede freezar y por cuánto (freezer_days, null si no conviene), cómo recalentarla (reheat, una frase) y un consejo breve de conservación (tip, o null). Voseo, sin markdown.`;

/** Genera una sola vez la info de conservación de las recetas del plan que todavía no la tienen. */
export async function ensureStorageInfo(
  supabase: SupabaseClient<Database>,
  args: { planId: string; userId: string; groupId: string },
): Promise<number> {
  const { data: rows } = await supabase
    .from("meal_plan_entries")
    .select("recipe_id, recipes(id, title, storage_info, recipe_ingredients(raw_text))")
    .eq("plan_id", args.planId)
    .not("recipe_id", "is", null);
  const missing = new Map<string, { title: string; ingredients: string[] }>();
  for (const r of rows ?? []) {
    if (r.recipes && !r.recipes.storage_info)
      missing.set(r.recipes.id, {
        title: r.recipes.title,
        ingredients: (r.recipes.recipe_ingredients ?? [])
          .map((i) => i.raw_text ?? "")
          .filter(Boolean)
          .slice(0, 15),
      });
  }
  let saved = 0;
  for (const [id, recipe] of missing) {
    const run = await runStructured({
      feature: "ideas",
      model: MODELS.fast,
      system: SYSTEM,
      content: `Receta: ${recipe.title}\nIngredientes: ${recipe.ingredients.join(", ")}`,
      schema: storageInfoSchema,
      userId: args.userId,
      groupId: args.groupId,
      maxTokens: 400,
    });
    if (!run.ok) continue;
    const { error } = await supabase
      .from("recipes")
      .update({ storage_info: run.data })
      .eq("id", id);
    if (!error) saved++;
  }
  return saved;
}
