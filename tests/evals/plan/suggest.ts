/**
 * Eval de "¿Qué tenés?": con "pollo, zapallitos, huevos, limón" debe devolver al menos 2 opciones aptas
 * para las dos personas en menos de 6 s. Usa la IA real y la DB local. NO corre en CI.
 *
 *   pnpm eval:suggest
 */
import { createClient } from "@supabase/supabase-js";
import { suggestFromPantry } from "@/lib/ai/suggest/suggest";
import { addMemberToGroup, createTestUser } from "../../e2e/helpers/auth";
import { adminClient } from "../../e2e/helpers/auth";
import { createGroupAs, seedRecipe } from "../../e2e/helpers/recipes";
import { PLAN_RECIPES } from "./recipes";

process.loadEnvFile(".env.local");
const password = "password123";

async function main() {
  const run = Date.now();
  const aEmail = `eval-sug-a-${run}@test.com`;
  const aId = await createTestUser(aEmail, password, "Ana");
  const bId = await createTestUser(`eval-sug-b-${run}@test.com`, password, "Beto");
  const groupId = await createGroupAs(aEmail, password, "Casa Eval");
  await addMemberToGroup(groupId, bId);
  await adminClient()
    .from("food_profiles")
    .insert({
      user_id: aId,
      summary: "Sin cebolla",
      data: {
        restrictions: [{ target: "cebolla", type: "ingredient", severity: "forbidden" }],
        goals: [],
        likes: [],
        dislikes: [],
        cuisines: [],
        schedule: {},
      },
    });
  for (const rec of PLAN_RECIPES) await seedRecipe(aEmail, password, groupId, rec);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  await supabase.auth.signInWithPassword({ email: aEmail, password });

  const started = Date.now();
  const res = await suggestFromPantry({
    supabase,
    userId: aId,
    groupId,
    have: ["pollo", "zapallitos", "huevos", "limón"],
    filters: { quick: false, noOven: false, light: false },
  });
  const seconds = (Date.now() - started) / 1000;
  if (!res.ok) throw new Error(res.error);
  for (const c of res.cards)
    console.log(`- ${c.title} (${c.totalMinutes ?? "?"} min) · ${c.label}\n    ${c.line}`);
  const ok = res.cards.length >= 2 && seconds < 6;
  const withOnion = res.cards.filter((c) => /cebolla/i.test(c.title));
  console.log(
    `\n${ok && withOnion.length === 0 ? "✅" : "❌"} ${res.cards.length} opciones en ${seconds.toFixed(1)} s`,
  );
  process.exit(ok && withOnion.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("EVAL ERROR", e);
  process.exit(2);
});
