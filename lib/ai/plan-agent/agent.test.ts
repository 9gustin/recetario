import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/recipes/actions", () => ({ saveRecipe: vi.fn() }));
vi.mock("@/lib/recipes/compatibility", () => ({ loadIngredientsForCheck: vi.fn() }));
vi.mock("@/lib/plan/queries", () => ({ getPlanEntries: vi.fn() }));

import { MODELS } from "@/lib/ai/models";
import type { AiRunRow } from "@/lib/ai/run-structured";
import { runPlanAgent, type PlanStreamingClient } from "./agent";
import type { PlanAgentEvent } from "./events";
import type { PlanToolCtx } from "./tools";

type Msg = Anthropic.Messages.Message;
const usage = { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 0 };
const text = (t: string): Msg =>
  ({ stop_reason: "end_turn", content: [{ type: "text", text: t }], usage }) as unknown as Msg;
const tool = (name: string, input: unknown, id: string): Msg =>
  ({
    stop_reason: "tool_use",
    content: [{ type: "tool_use", id, name, input }],
    usage,
  }) as unknown as Msg;

function fake(responses: Msg[]) {
  const queue = [...responses];
  const calls: Anthropic.Messages.MessageStreamParams[] = [];
  const client = {
    messages: {
      stream: (params: Anthropic.Messages.MessageStreamParams) => {
        calls.push(JSON.parse(JSON.stringify(params)));
        const next = queue.shift();
        if (!next) throw new Error("sin respuestas");
        return { on: () => undefined, finalMessage: async () => next };
      },
    },
  } as unknown as PlanStreamingClient;
  return { client, calls };
}

const ctx = { userId: "u", groupId: "g", planId: "p" } as unknown as PlanToolCtx;
const base = {
  model: MODELS.smart,
  system: "s",
  history: [],
  userContent: "armame la semana",
  toolCtx: ctx,
};

describe("runPlanAgent", () => {
  it("una escritura rechazada vuelve al modelo como tool_result con is_error y el modelo corrige", async () => {
    const { client, calls } = fake([
      tool("set_plan", { entries: [] }, "t1"),
      tool("set_plan", { entries: [{ ok: true }] }, "t2"),
      text("Listo, saqué la cebolla."),
    ]);
    const executeTool = vi
      .fn()
      .mockResolvedValueOnce({
        result: { applied: false, errors: ["[FORBIDDEN_INGREDIENT] tiene cebolla"] },
        isError: true,
      })
      .mockResolvedValueOnce({ result: { applied: true } });
    const events: PlanAgentEvent[] = [];
    const record = vi.fn(async (_row: AiRunRow) => "run");

    const res = await runPlanAgent(
      { ...base, emit: (e) => events.push(e) },
      { client, executeTool, record },
    );

    expect(res).toEqual({ ok: true, text: "" });
    const second = calls[1]!.messages.at(-1)!.content as Anthropic.Messages.ToolResultBlockParam[];
    expect(second[0]).toMatchObject({ tool_use_id: "t1", is_error: true });
    expect(String(second[0]!.content)).toContain("cebolla");
    const third = calls[2]!.messages.at(-1)!.content as Anthropic.Messages.ToolResultBlockParam[];
    expect(third[0]!.is_error).toBeUndefined();
    expect(events.filter((e) => e.type === "tool_started")).toHaveLength(2);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ feature: "plan_chat", status: "ok" }),
    );
  });

  it("si una herramienta lanza una excepción, el modelo recibe el error en vez de romper el loop", async () => {
    const { client } = fake([tool("search_recipes", {}, "t1"), text("ok")]);
    const executeTool = vi.fn().mockRejectedValue(new Error("db caída"));
    const res = await runPlanAgent(
      { ...base, emit: () => {} },
      { client, executeTool, record: async () => null },
    );
    expect(res.ok).toBe(true);
  });

  it("corta a las 12 iteraciones y registra el error", async () => {
    const { client } = fake(
      Array.from({ length: 12 }, (_, i) => tool("search_recipes", {}, `t${i}`)),
    );
    const record = vi.fn(async (_row: AiRunRow) => null);
    const res = await runPlanAgent(
      { ...base, emit: () => {} },
      { client, executeTool: async () => ({ result: {} }), record },
    );
    expect(res.ok).toBe(false);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ status: "error" }));
  });

  it("si el modelo falla devuelve un error amigable", async () => {
    const client = {
      messages: {
        stream: () => {
          throw new Error("boom");
        },
      },
    } as unknown as PlanStreamingClient;
    const res = await runPlanAgent(
      { ...base, emit: () => {} },
      { client, record: async () => null },
    );
    expect(res).toMatchObject({ ok: false });
  });
});
