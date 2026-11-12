import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MODELS } from "@/lib/ai/models";
import { fileBlocks, ingestFoodProfile } from "@/lib/ai/food-profile/ingest";
import { DIET_PLAN_SYSTEM } from "@/lib/ai/prompts/diet-plan";
import { runStructured } from "@/lib/ai/run-structured";
import { dietPlanDraftSchema, type DietPlanDraft } from "@/lib/schemas/diet-plan";
import type { Database } from "@/lib/supabase/database.types";
import { z } from "zod";

export const dietIngestSchema = z
  .object({
    text: z.string().trim().max(10_000).optional(),
    transcript: z.string().trim().max(10_000).optional(),
    filePaths: z.array(z.string().max(200)).max(3).optional(),
  })
  .refine((v) => v.text || v.transcript || v.filePaths?.length, {
    message: "Subí el plan, contalo o escribilo.",
  });
export type DietIngestInput = z.infer<typeof dietIngestSchema>;

export type DietIngestResult =
  | { ok: true; data: { planId: string; draft: DietPlanDraft; profileDraftId: string | null } }
  | { ok: false; error: string; status: number };

/** Digitaliza el plan de la nutricionista y lo guarda como borrador. Las restricciones se proponen al perfil aparte. */
export async function ingestDietPlan(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: DietIngestInput,
): Promise<DietIngestResult> {
  const files = input.filePaths?.length
    ? await fileBlocks(supabase, userId, input.filePaths)
    : { ok: true as const, blocks: [] };
  if (!files.ok) return { ok: false, error: files.error, status: 400 };

  const rows = [
    ...(input.text ? [{ kind: "text" as const, transcript: input.text, storage_path: null }] : []),
    ...(input.transcript
      ? [{ kind: "voice" as const, transcript: input.transcript, storage_path: null }]
      : []),
    ...(input.filePaths ?? []).map((path) => ({
      kind: "file" as const,
      transcript: null,
      storage_path: path,
    })),
  ];
  const { data: saved, error: inputError } = await supabase
    .from("food_profile_inputs")
    .insert(rows)
    .select("id");
  if (inputError || !saved)
    return { ok: false, error: "No pudimos guardar lo que subiste.", status: 500 };

  const text = [
    input.text ? `TEXTO:\n${input.text}` : "",
    input.transcript ? `DICTADO:\n${input.transcript}` : "",
    files.blocks.length ? "Adjunto el plan en archivos: leelos completos." : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const run = await runStructured({
    feature: "food_profile",
    model: MODELS.smart,
    system: DIET_PLAN_SYSTEM,
    content: [...files.blocks, { type: "text", text }],
    schema: dietPlanDraftSchema,
    userId,
    toolName: "digitalizar_plan",
    toolDescription: "Devuelve el plan de alimentación estructurado por momento del día.",
    maxTokens: 6000,
  });
  if (!run.ok) return { ok: false, error: run.error, status: 502 };

  const draft = run.data;
  const { data: result, error } = await supabase.rpc("save_diet_plan", {
    p_plan: {
      title: draft.title,
      summary: draft.summary ?? null,
      meals: draft.meals,
      rules: draft.rules,
      allowances: draft.allowances,
      starts_on: draft.starts_on ?? null,
      ends_on: draft.ends_on ?? null,
      next_checkup: draft.next_checkup ?? null,
      open_questions: draft.open_questions,
      source_input_ids: saved.map((r) => r.id),
    },
    p_change_note: "Digitalizado con IA",
  });
  const planId = (result as { id?: string } | null)?.id;
  if (error || !planId) return { ok: false, error: "No pudimos guardar el plan.", status: 500 };

  // Las restricciones se proponen al perfil (F5) como borrador: se confirman ahí. Si falla, no importa.
  let profileDraftId: string | null = null;
  if (draft.restrictions.length > 0) {
    const profile = await ingestFoodProfile(supabase, userId, {
      text: `Mi nutricionista me indicó: ${draft.restrictions.join("; ")}.`,
    }).catch(() => null);
    if (profile?.ok) profileDraftId = profile.data.draftId;
  }
  return { ok: true, data: { planId, draft, profileDraftId } };
}
