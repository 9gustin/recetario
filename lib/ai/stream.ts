/** Eventos tipados de un proceso largo en streaming (sin cola de trabajos: todo corre en la misma request). */
export type StreamEvent =
  | { type: "step"; name: string; status: "started" | "done" | "error"; detail?: string }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

export const encodeEvent = (event: StreamEvent) =>
  `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;

export function parseEventBlock(block: string): StreamEvent | null {
  const data = block
    .split("\n")
    .find((l) => l.startsWith("data:"))
    ?.slice(5)
    .trim();
  if (!data) return null;
  try {
    const parsed = JSON.parse(data) as StreamEvent;
    return typeof parsed?.type === "string" ? parsed : null;
  } catch {
    return null;
  }
}

/** Respuesta SSE: `run` emite eventos; al terminar (o fallar) se cierra el stream. */
export function sseResponse(run: (emit: (event: StreamEvent) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      // Si la persona se va, el trabajo sigue: emitir a un stream cerrado no debe cortarlo.
      const emit = (event: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(encodeEvent(event)));
        } catch {
          // stream cerrado
        }
      };
      try {
        await run(emit);
      } catch {
        emit({ type: "error", message: "Algo salió mal. Probá de nuevo." });
      } finally {
        try {
          controller.close();
        } catch {
          // ya cerrado
        }
      }
    },
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
