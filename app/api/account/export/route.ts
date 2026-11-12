import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Descarga todo lo propio en JSON: perfil, recetas, perfil alimentario, planes de alimentación, registros y planes de los grupos. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tenés que iniciar sesión." }, { status: 401 });

  const [profile, groups, recipes, food, diet, logs, plans] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, locale, created_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("group_members")
      .select("role, joined_at, groups(id, name, emoji, is_personal)")
      .eq("user_id", user.id),
    supabase
      .from("recipes")
      .select("*, recipe_ingredients(*), recipe_steps(*)")
      .eq("created_by", user.id)
      .is("deleted_at", null),
    supabase
      .from("food_profiles")
      .select("summary, data, valid_until, updated_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("diet_plans")
      .select("*, diet_plan_meals(*), diet_plan_swaps(*)")
      .eq("user_id", user.id),
    supabase.from("meal_logs").select("*").eq("user_id", user.id),
    supabase
      .from("meal_plans")
      .select("*, meal_plan_entries(*), prep_tasks(*)")
      .order("week_start", { ascending: false })
      .limit(60),
  ]);

  const body = {
    exported_at: new Date().toISOString(),
    email: user.email,
    profile: profile.data,
    groups: groups.data,
    recipes: recipes.data,
    food_profile: food.data,
    diet_plans: diet.data,
    meal_logs: logs.data,
    meal_plans: plans.data,
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="mis-datos-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
