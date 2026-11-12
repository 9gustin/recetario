import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));

import { MODELS } from "./models";
import { runStructured, type AiRunRow, type MessagesClient } from "./run-structured";

const schema = z.object({ title: z.string().min(1), servings: z.number().int().positive() });

const reply = (input: unknown, usage = { input_tokens: 100, output_tokens: 20 }) =>
  ({
    id: "msg",
    type: "message",
    role: "assistant",
    content: [{ type: "tool_use", id: "tu_1", name: "responder", input }],
    usage: { ...usage, cache_read_input_tokens: 50 },
  }) as unknown as Anthropic.Messages.Message;

function setup(responses: (Anthropic.Messages.Message | Error)[]) {
  const queue = [...responses];
  const create = vi.fn(async () => {
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return next!;
  });
  const rows: AiRunRow[] = [];
  const deps = {
    client: { messages: { create } } as unknown as MessagesClient,
    record: async (row: AiRunRow) => {
      rows.push(row);
      return `run-${rows.length}`;
    },
  };
  const run = () =>
    runStructured(
      {
        feature: "parse_recipe",
        model: MODELS.fast,
        system: "sistema",
        content: "texto",
        schema,
        userId: "u1",
      },
      deps,
    );
  return { create, rows, run };
}

describe("runStructured", () => {
  it("devuelve los datos cuando la salida es válida y registra el run", async () => {
    const { run, rows, create } = setup([reply({ title: "Pollo", servings: 2 })]);
    const res = await run();
    expect(res).toEqual({ ok: true, data: { title: "Pollo", servings: 2 }, runId: "run-1" });
    expect(create).toHaveBeenCalledTimes(1);
    expect(rows[0]).toMatchObject({
      status: "ok",
      feature: "parse_recipe",
      input_tokens: 100,
      output_tokens: 20,
      cache_read_tokens: 50,
    });
  });

  it("pide la herramienta con el esquema y cachea el system prompt", async () => {
    const { run, create } = setup([reply({ title: "Pollo", servings: 2 })]);
    await run();
    const params = (
      create.mock.calls[0] as unknown as [Anthropic.Messages.MessageCreateParamsNonStreaming]
    )[0];
    expect(params.tool_choice).toEqual({ type: "tool", name: "responder" });
    expect(params.tools?.[0]).toMatchObject({ name: "responder" });
    expect(JSON.stringify(params.tools)).toContain('"servings"');
    expect(JSON.stringify(params.system)).toContain("ephemeral");
  });

  it("si la salida es inválida reintenta una vez mostrando el error", async () => {
    const { run, rows, create } = setup([
      reply({ title: "", servings: "dos" }),
      reply({ title: "Pollo", servings: 2 }),
    ]);
    const res = await run();
    expect(res.ok).toBe(true);
    expect(create).toHaveBeenCalledTimes(2);
    const retry = (
      create.mock.calls[1] as unknown as [Anthropic.Messages.MessageCreateParamsNonStreaming]
    )[0];
    const last = retry.messages.at(-1)!;
    expect(JSON.stringify(last.content)).toContain("tool_result");
    expect(JSON.stringify(last.content)).toContain("is_error");
    expect(JSON.stringify(last.content)).toContain("servings");
    // Los tokens de los dos intentos se suman.
    expect(rows[0]?.input_tokens).toBe(200);
  });

  it("si falla dos veces devuelve error y lo registra", async () => {
    const { run, rows, create } = setup([reply({ nope: 1 }), reply({ nope: 2 })]);
    const res = await run();
    expect(res.ok).toBe(false);
    expect(create).toHaveBeenCalledTimes(2);
    expect(rows[0]).toMatchObject({ status: "error" });
    expect(rows[0]?.error).toContain("no cumple el esquema");
  });

  it("si la API falla devuelve un error amable y registra el motivo real", async () => {
    const { run, rows } = setup([new Error("overloaded")]);
    const res = await run();
    expect(res).toMatchObject({ ok: false });
    if (!res.ok) expect(res.error).not.toContain("overloaded");
    expect(rows[0]).toMatchObject({ status: "error", error: "overloaded" });
  });
});

describe("runStructured con modelos que no admiten tool_choice forzado", () => {
  it("usa tool_choice auto y refuerza en el system prompt", async () => {
    const create = vi.fn(async () => reply({ title: "Pollo", servings: 2 }));
    const rows: AiRunRow[] = [];
    const res = await runStructured(
      {
        feature: "parse_recipe",
        model: MODELS.smart,
        system: "sistema",
        content: "texto",
        schema,
        userId: "u1",
      },
      {
        client: { messages: { create } } as unknown as MessagesClient,
        record: async (r) => (rows.push(r), "run"),
      },
    );
    expect(res.ok).toBe(true);
    const params = (
      create.mock.calls[0] as unknown as [Anthropic.Messages.MessageCreateParamsNonStreaming]
    )[0];
    expect(params.tool_choice).toEqual({ type: "auto" });
    expect(JSON.stringify(params.system)).toContain(
      "respondé únicamente llamando a la herramienta",
    );
  });

  it("si contesta con texto en vez de la herramienta, le pide usarla y reintenta", async () => {
    const textOnly = {
      id: "m",
      content: [{ type: "text", text: "Acá está" }],
      usage: { input_tokens: 5, output_tokens: 5 },
    } as unknown as Anthropic.Messages.Message;
    const queue = [textOnly, reply({ title: "Pollo", servings: 2 })];
    const create = vi.fn(async () => queue.shift()!);
    const res = await runStructured(
      {
        feature: "parse_recipe",
        model: MODELS.smart,
        system: "s",
        content: "t",
        schema,
        userId: "u1",
      },
      { client: { messages: { create } } as unknown as MessagesClient, record: async () => "run" },
    );
    expect(res.ok).toBe(true);
    expect(create).toHaveBeenCalledTimes(2);
  });
});
