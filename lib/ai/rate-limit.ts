import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Límites por usuario y por día (hora de Argentina). */
export const AI_QUOTAS = {
  parse_recipe: 30,
  food_profile: 20,
  plan_chat: 60,
  assistant: 60,
  transcribe: 40,
  ideas: 30,
} as const;

export type AiFeature = keyof typeof AI_QUOTAS;

/** Consume una unidad de cuota de forma atómica. `false` = ya llegó al límite de hoy. */
export async function checkQuota(userId: string, feature: AiFeature): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("consume_ai_quota", {
    p_user_id: userId,
    p_feature: feature,
    p_limit: AI_QUOTAS[feature],
  });
  if (error) throw new Error(`No se pudo verificar la cuota: ${error.message}`);
  return data === true;
}
