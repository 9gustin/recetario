import type { SupabaseClient } from "@supabase/supabase-js";
import { MODELS } from "@/lib/ai/models";
import { MEAL_PREP_SYSTEM } from "@/lib/ai/prompts/meal-prep";
import { runStructured } from "@/lib/ai/run-structured";
import { validatePrep, type PrepEntryInfo, type PrepRejection } from "@/lib/domain/validate-prep";
import { addDays, dayLabel } from "@/lib/domain/week";
import { prepOutputSchema } from "@/lib/schemas/prep";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export type PrepResult =
  | { ok: true; saved: number; rejected: PrepRejection[]; tips: string[] }
  | { ok: false; error: string };

const maxFridge = (shelf: unknown): number | null => {
  const f = (shelf as { fridge?: unknown } | null)?.fridge;
  return Array.isArray(f) && typeof f[1] === "number" ? f[1] : null;
};

/** Genera las preparaciones del plan, descarta las inválidas por código y reemplaza las no completadas. */
export async function generatePrepTasks(
  supabase: Client,
  args: { planId: string; userId: string; groupId: string },
): Promise<PrepResult> {
  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id, week_start")
    .eq("id", args.planId)
    .maybeSingle();
  if (!plan) return { ok: false, error: "No encontramos el plan." };

  const { data: rows } = await supabase
    .from("meal_plan_entries")
    .select(
      "id, date, slot, cook_date, leftovers_of_entry_id, servings, recipes(title, total_minutes, recipe_ingredients(raw_text, ingredients(name, shelf_life)))",
    )
    .eq("plan_id", args.planId);
  const entries = (rows ?? []).filter((e) => e.recipes && !e.leftovers_of_entry_id);
  if (entries.length === 0) return { ok: true, saved: 0, rejected: [], tips: [] };

  const purchaseDate = addDays(plan.week_start, -1);
  const infos: PrepEntryInfo[] = entries.map((e) => {
    const shelves = (e.recipes?.recipe_ingredients ?? [])
      .map((i) => maxFridge(i.ingredients?.shelf_life))
      .filter((n): n is number => n !== null);
    return {
      id: e.id,
      useDate: e.cook_date ?? e.date,
      shelfDays: shelves.length ? Math.min(...shelves) : null,
    };
  });

  const description = entries
    .map((e) => {
      const info = infos.find((i) => i.id === e.id)!;
      const ingredients = (e.recipes?.recipe_ingredients ?? [])
        .map((i) => i.ingredients?.name ?? i.raw_text)
        .filter(Boolean)
        .slice(0, 12)
        .join(", ");
      return `- id ${e.id}: ${dayLabel(info.useDate)} (${info.useDate}), ${e.slot}: ${e.recipes?.title} (${e.recipes?.total_minutes ?? "?"} min). Ingredientes: ${ingredients}. Vida útil en heladera: ${info.shelfDays ?? "sin dato"} días.`;
    })
    .join("\n");

  const run = await runStructured({
    feature: "plan_chat",
    model: MODELS.smart,
    system: MEAL_PREP_SYSTEM,
    content: `Fecha de compra: ${purchaseDate}.\nPlan:\n${description}`,
    schema: prepOutputSchema,
    userId: args.userId,
    groupId: args.groupId,
    maxTokens: 4000,
  });
  if (!run.ok) return { ok: false, error: run.error };

  const { valid, rejected } = validatePrep(run.data.tasks, infos, purchaseDate);
  const byTitle = new Map(run.data.tasks.map((t) => [t.title + t.suggested_date, t]));

  // Reemplaza las no completadas; las tildadas se conservan.
  await supabase.from("prep_tasks").delete().eq("plan_id", args.planId).is("done_at", null);
  if (valid.length > 0) {
    const { error } = await supabase.from("prep_tasks").insert(
      valid.map((t) => {
        const full = byTitle.get(t.title + t.suggested_date);
        return {
          plan_id: args.planId,
          title: t.title,
          details: t.details ?? null,
          suggested_date: t.suggested_date,
          duration_minutes: full?.duration_minutes ?? null,
          kind: t.kind,
          related_entry_ids: t.related_entry_ids,
          remind_at: full?.remind_time
            ? new Date(`${t.suggested_date}T${full.remind_time}:00-03:00`).toISOString()
            : null,
        };
      }),
    );
    if (error) return { ok: false, error: "No se pudieron guardar las preparaciones." };
  }
  await supabase.from("meal_plans").update({ prep_tips: run.data.tips }).eq("id", args.planId);
  return { ok: true, saved: valid.length, rejected, tips: run.data.tips };
}
