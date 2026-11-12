import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ProProfile = {
  user_id: string;
  display_name: string;
  license: string | null;
  bio: string | null;
};

export async function getProProfile(userId: string): Promise<ProProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("professional_profiles")
    .select("user_id, display_name, license, bio")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export type ProLink = {
  id: string;
  pro_id: string;
  patient_id: string | null;
  label: string;
  pro_name: string;
  token: string;
  status: "invited" | "active" | "revoked";
  share_meals: boolean;
  share_notes: boolean;
  created_at: string;
};
const LINK_COLUMNS =
  "id, pro_id, patient_id, label, pro_name, token, status, share_meals, share_notes, created_at";

/** Pacientes del profesional (sin los vínculos terminados). */
export async function getProLinks(proId: string): Promise<ProLink[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pro_links")
    .select(LINK_COLUMNS)
    .eq("pro_id", proId)
    .neq("status", "revoked")
    .order("created_at", { ascending: false });
  return (data ?? []) as ProLink[];
}

export async function getProLink(linkId: string): Promise<ProLink | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pro_links")
    .select(LINK_COLUMNS)
    .eq("id", linkId)
    .maybeSingle();
  return (data as ProLink | null) ?? null;
}

/** Profesionales con los que está vinculado el paciente. */
export async function getMyProLinks(userId: string): Promise<ProLink[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pro_links")
    .select(LINK_COLUMNS)
    .eq("patient_id", userId)
    .neq("status", "revoked")
    .order("created_at", { ascending: false });
  return (data ?? []) as ProLink[];
}

export type ProPlanRow = {
  id: string;
  title: string;
  goal: string | null;
  goal_tags: string[];
  notes: string | null;
  is_template: boolean;
  updated_at: string;
};

export async function getProPlans(): Promise<ProPlanRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pro_plans")
    .select("id, title, goal, goal_tags, notes, is_template, updated_at")
    .order("updated_at", { ascending: false });
  return data ?? [];
}

export type ProPlanItem = {
  id: string;
  recipe_id: string | null;
  free_text: string | null;
  quantity: number;
  note: string | null;
  title: string;
};

export async function getProPlan(
  id: string,
): Promise<{ plan: ProPlanRow; items: ProPlanItem[] } | null> {
  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("pro_plans")
    .select("id, title, goal, goal_tags, notes, is_template, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!plan) return null;
  const { data: rows } = await supabase
    .from("pro_plan_items")
    .select("id, recipe_id, title, free_text, quantity, note")
    .eq("plan_id", id)
    .order("position");
  return {
    plan,
    items: (rows ?? []).map((r) => ({
      ...r,
      title: r.title || r.free_text || "Receta",
    })),
  };
}

export type DeliveryRow = {
  id: string;
  link_id: string;
  kind: "plan" | "recipes";
  title: string;
  message: string | null;
  status: "pending" | "accepted" | "dismissed";
  items: { title?: string; quantity?: number }[];
  created_at: string;
};

export async function getDeliveries(linkIds: string[]): Promise<DeliveryRow[]> {
  if (linkIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("pro_deliveries")
    .select("id, link_id, kind, title, message, status, items, created_at")
    .in("link_id", linkIds)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as unknown as DeliveryRow[];
}

export type PatientLog = {
  logs: { date: string; slot: string; status: string; note: string | null }[];
  cooked: { date: string; title: string; rating: number | null }[];
  share_notes: boolean;
};

/** Seguimiento del paciente (solo si compartió; cada lectura queda registrada). */
export async function getPatientLog(
  linkId: string,
  from: string,
  to: string,
): Promise<PatientLog | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pro_patient_log", {
    p_link_id: linkId,
    p_from: from,
    p_to: to,
  });
  if (error || !data) return null;
  return data as unknown as PatientLog;
}

export async function getAccessLog(linkIds: string[]) {
  if (linkIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("pro_access_log")
    .select("link_id, accessed_at")
    .in("link_id", linkIds)
    .order("accessed_at", { ascending: false })
    .limit(10);
  return data ?? [];
}
