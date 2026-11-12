import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MODELS } from "@/lib/ai/models";
import type { AiRunRow } from "@/lib/ai/run-structured";
import { pickAssistantModel, runAssistant, type AgentDeps, type StreamingClient } from "./agent";
import type { AssistantEvent } from "./events";
import type { ToolCtx } from "./tools";

type Msg = Anthropic.Messages.Message;
const usage = { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 40 };

const textMessage = (text: string): Msg =>
  ({
    id: "m",
    stop_reason: "end_turn",
    content: [{ type: "text", text }],
    usage,
  }) as unknown as Msg;
const toolMessage = (name: string, input: unknown, id = "tu_1"): Msg =>
  ({
    id: "m",
    stop_reason: "tool_use",
    content: [{ type: "tool_use", id, name, input }],
    usage,
  }) as unknown as Msg;

/** Cliente falso: cada llamada a stream() devuelve la siguiente respuesta, emitiendo su texto por partes. */
function fakeClient(responses: { message: Msg; deltas?: string[] }[]) {
  const queue = [...responses];
  const stream = vi.fn(() => {
    const next = queue.shift();
    if (!next) throw new Error("sin más respuestas");
    let listener: (t: string) => void = () => {};
    return {
      on: (_e: "text", cb: (t: string) => void) => (listener = cb),
      finalMessage: async () => {
        next.deltas?.forEach((d) => listener(d));
        return next.message;
      },
    };
  });
  return { client: { messages: { stream } } as unknown as StreamingClient, stream };
}

const ctx = { userId: "u1", groupId: "g1", supabase: {} } as unknown as ToolCtx;

function setup(
  responses: Parameters<typeof fakeClient>[0],
  executeTool: NonNullable<AgentDeps["executeTool"]> = async () => ({ result: { ok: true } }),
) {
  const { client, stream } = fakeClient(responses);
  const events: AssistantEvent[] = [];
  const rows: AiRunRow[] = [];
  const run = (overrides: { maxIterations?: number } = {}) =>
    runAssistant(
      {
        model: MODELS.fast,
        system: "sistema",
        history: [],
        userContent: "¿le puedo poner brócoli?",
        toolCtx: ctx,
        emit: (e) => events.push(e),
        ...overrides,
      },
      { client, executeTool, record: async (r) => (rows.push(r), "run-1") },
    );
  return { run, events, rows, stream, executeTool };
}

describe("runAssistant", () => {
  it("streamea el texto, devuelve la respuesta y registra el run", async () => {
    const { run, events, rows } = setup([
      {
        message: textMessage("Sí, ponelo en el paso 3."),
        deltas: ["Sí, ", "ponelo en el paso 3."],
      },
    ]);
    const res = await run();
    expect(res).toEqual({ ok: true, text: "Sí, ponelo en el paso 3.", proposals: [] });
    expect(
      events.filter((e) => e.type === "text_delta").map((e) => (e as { text: string }).text),
    ).toEqual(["Sí, ", "ponelo en el paso 3."]);
    expect(rows[0]).toMatchObject({
      feature: "assistant",
      status: "ok",
      input_tokens: 100,
      cache_read_tokens: 40,
      group_id: "g1",
    });
  });

  it("ejecuta las herramientas que pide el modelo y le devuelve los resultados", async () => {
    const executeTool = vi.fn(async () => ({ result: { status: "sin_perfil" } }));
    const { run, events, stream } = setup(
      [
        { message: toolMessage("check_compatibility", { recipe_id: "r1", changes: ["brócoli"] }) },
        {
          message: textMessage("Va bien: sumalo en el paso 3."),
          deltas: ["Va bien: sumalo en el paso 3."],
        },
      ],
      executeTool,
    );
    const res = await run();
    expect(res.ok).toBe(true);
    expect(executeTool).toHaveBeenCalledWith(
      "check_compatibility",
      { recipe_id: "r1", changes: ["brócoli"] },
      ctx,
    );
    expect(events.map((e) => e.type)).toEqual(["tool_started", "text_delta"]);
    // La segunda llamada trae el tool_result con el resultado.
    const second = (stream.mock.calls[1] as unknown as [Anthropic.Messages.MessageStreamParams])[0];
    expect(JSON.stringify(second.messages.at(-1))).toContain("sin_perfil");
    expect(JSON.stringify(second.messages.at(-1))).toContain("tool_result");
  });

  it("emite las tarjetas de propuesta y las devuelve", async () => {
    const proposal = {
      kind: "note",
      recipeId: "r1",
      recipeTitle: "Pollo",
      text: "Probar con brócoli",
    } as const;
    const executeTool = vi.fn(async () => ({ result: { status: "propuesta_lista" }, proposal }));
    const { run, events } = setup(
      [
        { message: toolMessage("propose_note", { recipe_id: "r1", text: "x" }) },
        { message: textMessage("Te dejé una nota para confirmar.") },
      ],
      executeTool,
    );
    const res = await run();
    expect(res).toMatchObject({ ok: true, proposals: [proposal] });
    expect(events).toContainEqual({ type: "proposal", proposal });
  });

  it("si una herramienta falla, se lo cuenta al modelo y sigue", async () => {
    const executeTool = vi.fn(async () => {
      throw new Error("se cayó");
    });
    const { run, stream } = setup(
      [
        { message: toolMessage("get_recipe", { recipe_id: "r1" }) },
        { message: textMessage("No pude ver la receta.") },
      ],
      executeTool,
    );
    expect((await run()).ok).toBe(true);
    const second = (stream.mock.calls[1] as unknown as [Anthropic.Messages.MessageStreamParams])[0];
    expect(JSON.stringify(second.messages.at(-1))).toContain("is_error");
  });

  it("corta después del máximo de iteraciones y lo registra como error", async () => {
    const { run, rows } = setup(
      Array.from({ length: 3 }, () => ({
        message: toolMessage("get_recipe", { recipe_id: "r1" }),
      })),
    );
    const res = await run({ maxIterations: 3 });
    expect(res.ok).toBe(false);
    expect(rows[0]).toMatchObject({ status: "error" });
    expect(rows[0]?.error).toContain("máximo de iteraciones");
  });

  it("si la API falla, devuelve un error amable y lo registra", async () => {
    const stream = vi.fn(() => {
      throw new Error("overloaded");
    });
    const rows: AiRunRow[] = [];
    const res = await runAssistant(
      {
        model: MODELS.fast,
        system: "s",
        history: [],
        userContent: "hola",
        toolCtx: ctx,
        emit: () => {},
      },
      {
        client: { messages: { stream } } as unknown as StreamingClient,
        record: async (r) => (rows.push(r), null),
      },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).not.toContain("overloaded");
    expect(rows[0]).toMatchObject({ status: "error", error: "overloaded" });
  });
});

describe("pickAssistantModel", () => {
  it("usa el modelo rápido salvo que se citen dos o más recetas", () => {
    expect(pickAssistantModel({ mentions: 0, origin: "home" })).toBe(MODELS.fast);
    expect(pickAssistantModel({ mentions: 1, origin: "recipe" })).toBe(MODELS.fast);
    expect(pickAssistantModel({ mentions: 2, origin: "home" })).toBe(MODELS.smart);
  });
});
