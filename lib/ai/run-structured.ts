import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getAnthropic } from "./client";
import { SUPPORTS_FORCED_TOOL, type ModelId } from "./models";

type MessageParam = Anthropic.Messages.MessageParam;

/** Lo mínimo del cliente que usamos (permite inyectar uno falso en los tests). */
export type MessagesClient = {
  messages: {
    create: (
      params: Anthropic.Messages.MessageCreateParamsNonStreaming,
    ) => Promise<Anthropic.Messages.Message>;
  };
};

export type AiRunRow = {
  user_id: string;
  group_id: string | null;
  feature: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  latency_ms: number;
  status: "ok" | "error";
  error: string | null;
};

export type AiDeps = {
  client?: MessagesClient;
  /** Guarda el registro en `ai_runs` y devuelve su id. */
  record?: (row: AiRunRow) => Promise<string | null>;
  now?: () => number;
};

export type RunStructuredArgs<T> = {
  /** Nombre de la función de IA (cuotas y trazabilidad): "parse_recipe", "food_profile"… */
  feature: string;
  model: ModelId;
  system: string;
  content: string | Anthropic.Messages.ContentBlockParam[];
  schema: z.ZodType<T>;
  userId: string;
  groupId?: string | null;
  toolName?: string;
  toolDescription?: string;
  maxTokens?: number;
};

export type RunResult<T> =
  { ok: true; data: T; runId: string | null } | { ok: false; error: string; runId: string | null };

async function defaultRecord(row: AiRunRow): Promise<string | null> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { data } = await createAdminClient().from("ai_runs").insert(row).select("id").single();
  return data?.id ?? null;
}

const formatIssues = (error: z.ZodError) =>
  error.issues.map((i) => `${i.path.join(".") || "(raíz)"}: ${i.message}`).join("; ");

/**
 * Llama a Claude pidiendo la salida como una herramienta con el JSON Schema derivado de `schema`,
 * la valida con Zod (con un reintento que le muestra el error) y registra el run en `ai_runs`,
 * también cuando falla.
 */
export async function runStructured<T>(
  args: RunStructuredArgs<T>,
  deps: AiDeps = {},
): Promise<RunResult<T>> {
  const client = deps.client ?? getAnthropic();
  const record = deps.record ?? defaultRecord;
  const now = deps.now ?? Date.now;
  const toolName = args.toolName ?? "responder";
  const forced = SUPPORTS_FORCED_TOOL[args.model] ?? false;

  const { $schema: _ignored, ...inputSchema } = z.toJSONSchema(args.schema) as Record<
    string,
    unknown
  >;
  void _ignored;
  if (inputSchema.type !== "object") throw new Error("El esquema de salida debe ser un objeto");

  const started = now();
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheRead = 0;
  let lastError = "Sin respuesta";
  let messages: MessageParam[] = [{ role: "user", content: args.content }];

  const finish = async (status: "ok" | "error", error: string | null) =>
    record({
      user_id: args.userId,
      group_id: args.groupId ?? null,
      feature: args.feature,
      model: args.model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_read_tokens: cacheRead,
      latency_ms: now() - started,
      status,
      error,
    });

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await client.messages.create({
        model: args.model,
        max_tokens: args.maxTokens ?? 4096,
        // El system prompt se cachea: en llamadas repetidas se paga mucho menos.
        system: [
          {
            type: "text",
            text: forced
              ? args.system
              : `${args.system}\n\nIMPORTANTE: respondé únicamente llamando a la herramienta "${toolName}".`,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages,
        tools: [
          {
            name: toolName,
            description: args.toolDescription ?? "Devuelve el resultado con la estructura pedida.",
            input_schema: inputSchema as Anthropic.Messages.Tool.InputSchema,
          },
        ],
        tool_choice: forced ? { type: "tool", name: toolName } : { type: "auto" },
      });
      inputTokens += res.usage?.input_tokens ?? 0;
      outputTokens += res.usage?.output_tokens ?? 0;
      cacheRead += res.usage?.cache_read_input_tokens ?? 0;

      const block = res.content.find((b) => b.type === "tool_use");
      if (!block || block.type !== "tool_use") {
        lastError = "El modelo no devolvió datos estructurados";
        // Con `auto` puede contestar con texto: se le pide una vez más que use la herramienta.
        messages = [
          ...messages,
          {
            role: "assistant",
            content: res.content.length ? res.content : [{ type: "text", text: "..." }],
          },
          {
            role: "user",
            content: `Respondé llamando a la herramienta "${toolName}" con la estructura pedida.`,
          },
        ];
        continue;
      }

      const parsed = args.schema.safeParse(block.input);
      if (parsed.success) {
        const runId = await finish("ok", null);
        return { ok: true, data: parsed.data, runId };
      }

      lastError = `La salida no cumple el esquema: ${formatIssues(parsed.error)}`;
      // Un solo reintento: se le muestra el error de validación como resultado de la herramienta.
      messages = [
        ...messages,
        { role: "assistant", content: res.content },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: block.id,
              is_error: true,
              content: `${lastError}. Corregí la respuesta y volvé a llamar a la herramienta.`,
            },
          ],
        },
      ];
    }
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
  }

  const runId = await finish("error", lastError);
  return {
    ok: false,
    error: "No pudimos procesar esto con IA en este momento. Probá de nuevo.",
    runId,
  };
}
