import type { CookingEdit } from "@/lib/domain/apply-cooking-edits";

/** Tarjetas de propuesta: el asistente solo propone, la persona confirma. */
export type Proposal =
  | {
      kind: "recipe_change";
      recipeId: string;
      recipeTitle: string;
      changeNote: string;
      ops: CookingEdit[];
      /** Una línea por cambio ("Paso 2: 25 min → 30 min", "+ 1 paso"). */
      summary: string[];
    }
  | { kind: "note"; recipeId: string; recipeTitle: string; text: string };

/** Eventos que el servidor manda por SSE. */
export type AssistantEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_started"; name: string }
  | { type: "proposal"; proposal: Proposal }
  | { type: "done"; conversationId: string }
  | { type: "error"; message: string };

export const encodeSse = (event: AssistantEvent) =>
  `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;

/** Parsea un bloque SSE ("event: x\ndata: {...}") a un evento, o null si no se entiende. */
export function parseSseBlock(block: string): AssistantEvent | null {
  const data = block
    .split("\n")
    .find((l) => l.startsWith("data:"))
    ?.slice(5)
    .trim();
  if (!data) return null;
  try {
    const parsed = JSON.parse(data) as AssistantEvent;
    return typeof parsed?.type === "string" ? parsed : null;
  } catch {
    return null;
  }
}
