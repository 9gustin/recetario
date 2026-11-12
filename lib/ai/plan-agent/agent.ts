import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic } from "@/lib/ai/client";
import type { ModelId } from "@/lib/ai/models";
import { recordAiRun, type AiRunRow } from "@/lib/ai/run-structured";
import type { PlanAgentEvent } from "./events";
import { planToolDefinitions, runPlanTool, type PlanToolCtx, type PlanToolOutput } from "./tools";

type MessageParam = Anthropic.Messages.MessageParam;

export type PlanStreamingClient = {
  messages: {
    stream: (params: Anthropic.Messages.MessageStreamParams) => {
      on: (event: "text", listener: (text: string) => void) => unknown;
      finalMessage: () => Promise<Anthropic.Messages.Message>;
    };
  };
};

export type PlanAgentDeps<C extends AgentToolCtx = PlanToolCtx> = {
  client?: PlanStreamingClient;
  executeTool?: (name: string, input: unknown, ctx: C) => Promise<PlanToolOutput>;
  record?: (row: AiRunRow) => Promise<string | null>;
  now?: () => number;
};

/** Lo mínimo que el loop necesita del contexto de las herramientas (para registrar el run). */
export type AgentToolCtx = { userId: string; groupId: string | null };

export type PlanAgentArgs<C extends AgentToolCtx = PlanToolCtx> = {
  model: ModelId;
  system: string;
  history: MessageParam[];
  userContent: string;
  toolCtx: C;
  /** Herramientas del agente (por defecto, las del plan semanal). */
  tools?: Anthropic.Messages.Tool[];
  /** Nombre de la función para `ai_runs` (por defecto, plan_chat). */
  feature?: string;
  emit: (event: PlanAgentEvent) => void;
  maxIterations?: number;
};

export type PlanAgentResult =
  { ok: true; text: string } | { ok: false; error: string; text: string };

export const PLAN_MAX_ITERATIONS = 12;

/**
 * Loop del agente del plan: llama al modelo, ejecuta sus herramientas (las de escritura validan por
 * código y devuelven `is_error` si rompen una restricción) y repite hasta la respuesta final.
 */
export async function runPlanAgent<C extends AgentToolCtx = PlanToolCtx>(
  args: PlanAgentArgs<C>,
  deps: PlanAgentDeps<C> = {},
): Promise<PlanAgentResult> {
  const client = deps.client ?? (getAnthropic() as unknown as PlanStreamingClient);
  const execute =
    deps.executeTool ?? (runPlanTool as unknown as NonNullable<PlanAgentDeps<C>["executeTool"]>);
  const record = deps.record ?? recordAiRun;
  const now = deps.now ?? Date.now;
  const limit = args.maxIterations ?? PLAN_MAX_ITERATIONS;

  const started = now();
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheRead = 0;
  let text = "";
  const messages: MessageParam[] = [...args.history, { role: "user", content: args.userContent }];
  const tools = args.tools ?? planToolDefinitions();

  const finish = (status: "ok" | "error", error: string | null) =>
    record({
      user_id: args.toolCtx.userId,
      group_id: args.toolCtx.groupId,
      feature: args.feature ?? "plan_chat",
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
        max_tokens: 4000,
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
        return { ok: true, text };
      }

      messages.push({ role: "assistant", content: final.content });
      // Las herramientas de lectura que el modelo pide juntas corren en paralelo (menos tiempo total);
      // las de escritura van de a una y en orden.
      const READ_ONLY = new Set([
        "search_recipes",
        "search_catalog",
        "get_recent_meals",
        "get_participants",
        "get_ingredient_info",
        "list_meals",
      ]);
      const runOne = async (
        use: Anthropic.Messages.ToolUseBlock,
      ): Promise<Anthropic.Messages.ToolResultBlockParam> => {
        args.emit({ type: "tool_started", name: use.name });
        try {
          const out = await execute(use.name, use.input, args.toolCtx);
          return {
            type: "tool_result",
            tool_use_id: use.id,
            content: JSON.stringify(out.result),
            ...(out.isError ? { is_error: true } : {}),
          };
        } catch (e) {
          return {
            type: "tool_result",
            tool_use_id: use.id,
            is_error: true,
            content: `La herramienta falló: ${e instanceof Error ? e.message : "error"}`,
          };
        }
      };
      const results: Anthropic.Messages.ToolResultBlockParam[] = new Array(toolUses.length);
      const readIdx = toolUses.flatMap((u, i) => (READ_ONLY.has(u.name) ? [i] : []));
      await Promise.all(readIdx.map(async (i) => void (results[i] = await runOne(toolUses[i]!))));
      for (let i = 0; i < toolUses.length; i++) {
        if (!READ_ONLY.has(toolUses[i]!.name)) results[i] = await runOne(toolUses[i]!);
      }
      messages.push({ role: "user", content: results });
    }
    await finish("error", "Se agotó el máximo de iteraciones del agente");
    return {
      ok: false,
      error: "No pude terminar de armar el plan. Probá pedirlo en partes más chicas.",
      text,
    };
  } catch (e) {
    await finish("error", e instanceof Error ? e.message : String(e));
    return { ok: false, error: "No pudimos armar el plan en este momento. Probá de nuevo.", text };
  }
}
