import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { MODELS } from "@/lib/ai/models";
import { SHOPPING_SYSTEM } from "@/lib/ai/prompts/shopping";
import { runStructured } from "@/lib/ai/run-structured";
import { daysBetween } from "@/lib/domain/week";
import type { Database } from "@/lib/supabase/database.types";

const enrichSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      purchase_hint: z.string().max(120).nullable(),
      shelf_life_warning: z.string().max(200).nullable(),
    }),
  ),
});

/**
 * Completa `purchase_hint` y `shelf_life_warning` de los ítems pendientes con IA (Haiku).
 * Si falla, la lista queda como estaba (con lo determinístico): nunca bloquea.
 */
export async function enrichShoppingList(
  supabase: SupabaseClient<Database>,
  args: { listId: string; userId: string; groupId: string },
): Promise<void> {
  const { data: list } = await supabase
    .from("shopping_lists")
    .select("shop_date")
    .eq("id", args.listId)
    .maybeSingle();
  const { data: items } = await supabase
    .from("shopping_list_items")
    .select("id, display_name, quantity, unit, needed_by, purchase_hint, ingredients(shelf_life)")
    .eq("list_id", args.listId)
    .eq("is_manual", false)
    .eq("state", "pending");
  if (!items?.length) return;

  const lines = items.map((i) => {
    const fridge = (i.ingredients?.shelf_life as { fridge?: number[] } | null)?.fridge?.[1];
    const days = list?.shop_date && i.needed_by ? daysBetween(list.shop_date, i.needed_by) : null;
    return `- id ${i.id}: ${i.display_name}, total ${i.quantity ?? "a gusto"} ${i.unit ?? ""}, se usa el ${i.needed_by ?? "?"}${
      days !== null ? ` (${days} días después de la compra)` : ""
    }${fridge ? `, dura ${fridge} días en heladera` : ""}`;
  });

  const run = await runStructured({
    feature: "ideas",
    model: MODELS.fast,
    system: SHOPPING_SYSTEM,
    content: lines.join("\n"),
    schema: enrichSchema,
    userId: args.userId,
    groupId: args.groupId,
    maxTokens: 3000,
  });
  if (!run.ok) return;

  const known = new Set(items.map((i) => i.id));
  for (const r of run.data.items) {
    if (!known.has(r.id)) continue;
    const patch: Database["public"]["Tables"]["shopping_list_items"]["Update"] = {};
    if (r.purchase_hint) patch.purchase_hint = r.purchase_hint;
    if (r.shelf_life_warning) patch.shelf_life_warning = r.shelf_life_warning;
    if (Object.keys(patch).length)
      await supabase.from("shopping_list_items").update(patch).eq("id", r.id);
  }
}
