import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic } from "@/lib/ai/client";
import { MODELS, type ModelId } from "@/lib/ai/models";
import { recordAiRun, type AiRunRow } from "@/lib/ai/run-structured";
import type { AssistantEvent, Proposal } from "./events";
import { runTool, toolDefinitions, type ToolCtx, type ToolOutput } from "./tools";

type MessageParam = Anthropic.Messages.MessageParam;

/** Lo mínimo del streaming del SDK que usamos (permite un cliente falso en los tests). */
export type StreamingClient = {
  messages: {
    stream: (params: Anthropic.Messages.MessageStreamParams) => {
      on: (event: "text", listener: (text: string) => void) => unknown;
      finalMessage: () => Promise<Anthropic.Messages.Message>;
    };
  };
};

export type AgentDeps = {
  client?: StreamingClient;
  executeTool?: (name: string, input: unknown, ctx: ToolCtx) => Promise<ToolOutput>;
  record?: (row: AiRunRow) => Promise<string | null>;
  now?: () => number;
};

export type AgentArgs = {
  model: ModelId;
  system: string;
  /** Mensajes anteriores de la conversación (solo texto). */
  history: MessageParam[];
  /** Mensaje nuevo, con el contexto armado por el servidor. */
  userContent: string;
  toolCtx: ToolCtx;
  emit: (event: AssistantEvent) => void;
  maxIterations?: number;
};

export type AgentResult =
  { ok: true; text: string; proposals: Proposal[] } | { ok: false; error: string; text: string };

/** Elige el modelo: rápido por defecto; el más capaz si se citan varias recetas. */
export function pickAssistantModel(opts: {
  mentions: number;
  origin: "home" | "recipe" | "cooking";
}): ModelId {
  return opts.mentions >= 2 ? MODELS.smart : MODELS.fast;
}

const MAX_ITERATIONS = 6;

/**
 * Loop del asistente: streamea el texto al cliente, ejecuta las herramientas que pide el modelo
 * (hasta 6 vueltas) y registra el run en `ai_runs`. Las acciones solo *proponen*: devuelven tarjetas.
 */
export async function runAssistant(args: AgentArgs, deps: AgentDeps = {}): Promise<AgentResult> {
  const client = deps.client ?? (getAnthropic() as unknown as StreamingClient);
  const execute = deps.executeTool ?? runTool;
  const record = deps.record ?? recordAiRun;
  const now = deps.now ?? Date.now;
  const limit = args.maxIterations ?? MAX_ITERATIONS;

  const started = now();
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheRead = 0;
  let text = "";
  const proposals: Proposal[] = [];
  const messages: MessageParam[] = [...args.history, { role: "user", content: args.userContent }];
  const tools = toolDefinitions();

  const finish = (status: "ok" | "error", error: string | null) =>
    record({
      user_id: args.toolCtx.userId,
      group_id: args.toolCtx.groupId,
      feature: "assistant",
      model: args.model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_read_tokens: cacheRead,
      latency_ms: now() - started,
      status,
      error,
    });

  try {
    for (let iteration = 0; iteration < limit; iteration++) {
      const stream = client.messages.stream({
        model: args.model,
        max_tokens: 1500,
        system: [{ type: "text", text: args.system, cache_control: { type: "ephemeral" } }],
        messages,
        tools,
      });
      stream.on("text", (delta) => {
        text += delta;
        args.emit({ type: "text_delta", text: delta });
      });
      const final = await stream.finalMessage();
      inputTokens += final.usage?.input_tokens ?? 0;
      outputTokens += final.usage?.output_tokens ?? 0;
      cacheRead += final.usage?.cache_read_input_tokens ?? 0;

      const toolUses = final.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
      );
      if (final.stop_reason !== "tool_use" || toolUses.length === 0) {
        await finish("ok", null);
        return { ok: true, text, proposals };
      }

      messages.push({ role: "assistant", content: final.content });
      const results: Anthropic.Messages.ToolResultBlockParam[] = [];
      for (const use of toolUses) {
        args.emit({ type: "tool_started", name: use.name });
        try {
          const out = await execute(use.name, use.input, args.toolCtx);
          if (out.proposal) {
            proposals.push(out.proposal);
            args.emit({ type: "proposal", proposal: out.proposal });
          }
          results.push({
            type: "tool_result",
            tool_use_id: use.id,
            content: JSON.stringify(out.result),
          });
        } catch (e) {
          results.push({
            type: "tool_result",
            tool_use_id: use.id,
            is_error: true,
            content: `La herramienta falló: ${e instanceof Error ? e.message : "error"}`,
          });
        }
      }
      messages.push({ role: "user", content: results });
    }
    // Se agotaron las vueltas sin una respuesta final.
    await finish("error", "Se agotó el máximo de iteraciones del agente");
    return {
      ok: false,
      error: "No pude terminar de armar la respuesta. Probá reformular la pregunta.",
      text,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await finish("error", message);
    return { ok: false, error: "No pudimos responder en este momento. Probá de nuevo.", text };
  }
}
