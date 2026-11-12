import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MODELS } from "@/lib/ai/models";
import { FOOD_PROFILE_SYSTEM } from "@/lib/ai/prompts/food-profile";
import { runStructured } from "@/lib/ai/run-structured";
import {
  emptyProfile,
  foodProfileDataSchema,
  foodProfileProposalSchema,
  type FoodProfileProposal,
} from "@/lib/schemas/food-profile";
import type { IngestRequest } from "@/lib/schemas/food-profile-requests";
import type { Database } from "@/lib/supabase/database.types";

export type IngestResult =
  | { ok: true; data: { draftId: string; proposal: FoodProfileProposal } }
  | { ok: false; error: string; status: number };

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

/** Fecha de hoy en Argentina (YYYY-MM-DD), para calcular vigencias como "hasta marzo". */
export function todayArgentina(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(
    now,
  );
}

async function fileBlocks(
  supabase: SupabaseClient<Database>,
  userId: string,
  paths: string[],
): Promise<
  { ok: true; blocks: Anthropic.Messages.ContentBlockParam[] } | { ok: false; error: string }
> {
  const blocks: Anthropic.Messages.ContentBlockParam[] = [];
  for (const path of paths) {
    if (!path.startsWith(`${userId}/`) || path.includes(".."))
      return { ok: false, error: "Archivo inválido." };
    const { data: blob, error } = await supabase.storage.from("profile-inputs").download(path);
    if (error || !blob)
      return { ok: false, error: "No pudimos leer el archivo. Probá subirlo de nuevo." };
    if (blob.size > MAX_FILE_BYTES) return { ok: false, error: "Un archivo pesa más de 10 MB." };
    const type = (blob.type || "").toLowerCase();
    const data = Buffer.from(await blob.arrayBuffer()).toString("base64");
    if (type === "application/pdf") {
      blocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data },
      });
    } else if ((IMAGE_TYPES as readonly string[]).includes(type)) {
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: type as (typeof IMAGE_TYPES)[number], data },
      });
    } else {
      return { ok: false, error: "Solo se aceptan PDF o fotos (JPG, PNG, WEBP)." };
    }
  }
  return { ok: true, blocks };
}

/** Procesa lo que la persona contó y devuelve un borrador de perfil para que lo revise. No guarda el perfil. */
export async function ingestFoodProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: IngestRequest,
): Promise<IngestResult> {
  const files = input.filePaths?.length
    ? await fileBlocks(supabase, userId, input.filePaths)
    : { ok: true as const, blocks: [] };
  if (!files.ok) return { ok: false, error: files.error, status: 400 };

  // Se guardan las fuentes (auditables y re-procesables) antes de llamar a la IA.
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
    ...(input.answers ?? []).map((a) => ({
      kind: "answer" as const,
      transcript: `${a.question} → ${a.answer}`,
      storage_path: null,
    })),
  ];
  const { data: saved, error: insertError } = await supabase
    .from("food_profile_inputs")
    .insert(rows)
    .select("id");
  if (insertError || !saved)
    return { ok: false, error: "No pudimos guardar lo que contaste.", status: 500 };
  const inputIds = saved.map((r) => r.id);

  const { data: current } = await supabase
    .from("food_profiles")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();
  const currentProfile =
    foodProfileDataSchema.safeParse(current?.data ?? {}).data ?? emptyProfile();

  const sections = [
    `Hoy es ${todayArgentina()}.`,
    `PERFIL ACTUAL (JSON):\n${JSON.stringify(currentProfile)}`,
    input.text ? `LO QUE CONTÓ (texto):\n${input.text}` : "",
    input.transcript ? `LO QUE CONTÓ (dictado):\n${input.transcript}` : "",
    input.answers?.length
      ? `RESPUESTAS A PREGUNTAS ANTERIORES:\n${input.answers.map((a) => `- ${a.question}\n  Respuesta: ${a.answer}`).join("\n")}`
      : "",
    files.blocks.length
      ? "También adjunto archivos con su plan o indicaciones: leelos y extraé las restricciones, objetivos y números."
      : "",
  ].filter(Boolean);

  const run = await runStructured({
    feature: "food_profile",
    model: MODELS.smart,
    system: FOOD_PROFILE_SYSTEM,
    content: [...files.blocks, { type: "text", text: sections.join("\n\n") }],
    schema: foodProfileProposalSchema,
    userId,
    toolName: "proponer_perfil",
    toolDescription:
      "Devuelve el perfil actualizado, el resumen, los cambios y las preguntas abiertas.",
    maxTokens: 4000,
  });
  if (!run.ok) return { ok: false, error: run.error, status: 502 };

  // Un solo borrador pendiente por persona.
  await supabase
    .from("food_profile_drafts")
    .update({ status: "discarded" })
    .eq("user_id", userId)
    .eq("status", "pending");
  const { data: draft, error: draftError } = await supabase
    .from("food_profile_drafts")
    .insert({
      proposed: run.data.profile,
      summary: run.data.summary,
      changes: run.data.changes,
      open_questions: run.data.open_questions,
      input_ids: inputIds,
    })
    .select("id")
    .single();
  if (draftError || !draft)
    return { ok: false, error: "No pudimos guardar el borrador.", status: 500 };

  await supabase.from("food_profile_inputs").update({ ai_run_id: run.runId }).in("id", inputIds);
  return { ok: true, data: { draftId: draft.id, proposal: run.data } };
}
