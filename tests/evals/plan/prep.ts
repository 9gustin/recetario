/**
 * Eval de meal prep: un plan con pollo tres veces → debería sugerir cortar/porcionar el día de la compra y
 * freezar lo del final de la semana. IA real + DB local; no corre en CI.   pnpm eval:prep
 */
import { createClient } from "@supabase/supabase-js";
import { generatePrepTasks } from "@/lib/ai/prep/generate";
import { addDays, weekStartOf } from "@/lib/domain/week";
import { createTestUser } from "../../e2e/helpers/auth";
import { createGroupAs, seedRecipe } from "../../e2e/helpers/recipes";

process.loadEnvFile(".env.local");
const password = "password123";

async function main() {
  const email = `eval-prep-${Date.now()}@test.com`;
  const userId = await createTestUser(email, password, "Ana");
  const groupId = await createGroupAs(email, password, "Casa");
  const mk = (title: string, ingredients: string[]) =>
    seedRecipe(email, password, groupId, {
      title,
      ingredients,
      steps: [{ instruction: "Cociná." }],
      totalMinutes: 30,
      servings: 4,
    });
  const r1 = await mk("Pollo al horno con papas", ["1 kg de pollo", "4 papas"]);
  const r2 = await mk("Wok de pollo y verduras", ["500 g de pollo", "1 zanahoria", "1 morrón"]);
  const r3 = await mk("Pollo a la mostaza", ["600 g de pollo", "mostaza"]);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  await supabase.auth.signInWithPassword({ email, password });
  const week = weekStartOf("2027-02-01", 1);
  const { data: plan } = await supabase
    .from("meal_plans")
    .insert({ group_id: groupId, week_start: week, status: "approved" })
    .select("id")
    .single();
  await supabase.from("meal_plan_entries").insert([
    { plan_id: plan!.id, date: addDays(week, 0), slot: "dinner", recipe_id: r1 },
    { plan_id: plan!.id, date: addDays(week, 2), slot: "dinner", recipe_id: r2 },
    { plan_id: plan!.id, date: addDays(week, 5), slot: "dinner", recipe_id: r3 },
  ]);

  const started = Date.now();
  const res = await generatePrepTasks(supabase, { planId: plan!.id, userId, groupId });
  if (!res.ok) throw new Error(res.error);
  const { data: tasks } = await supabase
    .from("prep_tasks")
    .select("title, kind, suggested_date, duration_minutes")
    .eq("plan_id", plan!.id)
    .order("suggested_date");
  for (const t of tasks ?? [])
    console.log(`- ${t.suggested_date} [${t.kind}] ${t.title} (${t.duration_minutes} min)`);
  console.log(
    `tips: ${res.tips.join(" | ")}\nrechazadas: ${res.rejected.map((r) => r.reason).join(" | ") || "ninguna"}`,
  );
  const portion = (tasks ?? []).some((t) => /porcion|cort|freez/i.test(t.title));
  console.log(
    `\n${portion && res.saved > 0 ? "✅" : "❌"} ${res.saved} tareas en ${((Date.now() - started) / 1000).toFixed(0)} s`,
  );
  process.exit(portion && res.saved > 0 ? 0 : 1);
}
main().catch((e) => {
  console.error("EVAL ERROR", e);
  process.exit(2);
});
