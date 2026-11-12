import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CheckRestriction } from "@/lib/domain/compatibility";
import { familyLabel } from "@/lib/domain/food-families";
import { restrictionSchema } from "@/lib/schemas/food-profile";
import type { Database } from "@/lib/supabase/database.types";
import { z } from "zod";

/** Restricciones vigentes de la persona (la RLS solo deja leer el propio perfil). */
export async function loadOwnRestrictions(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<CheckRestriction[]> {
  const { data } = await supabase
    .from("food_profiles")
    .select("data, valid_until")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return [];
  if (data.valid_until && data.valid_until < new Date().toISOString().slice(0, 10)) return [];
  const list = (data.data as { restrictions?: unknown } | null)?.restrictions;
  return (z.array(restrictionSchema).safeParse(list ?? []).data ?? []) as CheckRestriction[];
}

/** Resumen corto para el prompt del asistente ("NO puede comer: …; limita: …"). */
export function describeRestrictions(restrictions: CheckRestriction[]): string {
  if (restrictions.length === 0) return "";
  const label = (r: CheckRestriction) => {
    const base = r.type === "family" ? `${familyLabel(r.target)} (${r.target})` : r.target;
    const extra = r.includes?.length
      ? ` (incluye ${r.includes.join(", ")})`
      : r.limit
        ? ` (${r.limit})`
        : "";
    return `${base}${extra}`;
  };
  const forbidden = restrictions.filter((r) => r.severity === "forbidden").map(label);
  const limited = restrictions.filter((r) => r.severity === "limit").map(label);
  return [
    "Restricciones alimentarias de la persona que pregunta (respetalas siempre):",
    forbidden.length ? `- NO puede comer: ${forbidden.join("; ")}.` : "",
    limited.length ? `- Limita: ${limited.join("; ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
