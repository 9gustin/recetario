import "server-only";
import { createClient } from "@/lib/supabase/server";

export type OnboardingState = {
  onboarded: boolean;
  hasGroup: boolean;
  hasRecipe: boolean;
  hasProfile: boolean;
  personalGroupId: string | null;
};

/** Qué pasos del arranque ya están hechos (para las pantallas y el checklist de "Hoy"). */
export async function getOnboardingState(userId: string): Promise<OnboardingState> {
  const supabase = await createClient();
  const [{ data: profile }, { data: memberships }, { count: recipes }, { data: food }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("onboarded_at, personal_group_id")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("group_members").select("group_id, groups(is_personal)").eq("user_id", userId),
      supabase
        .from("recipes")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("created_by", userId),
      supabase.from("food_profiles").select("user_id").eq("user_id", userId).maybeSingle(),
    ]);
  return {
    onboarded: Boolean(profile?.onboarded_at),
    hasGroup: (memberships ?? []).some((m) => m.groups && !m.groups.is_personal),
    hasRecipe: (recipes ?? 0) > 0,
    hasProfile: Boolean(food),
    personalGroupId: profile?.personal_group_id ?? null,
  };
}
