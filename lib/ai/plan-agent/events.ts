import type { PlanIssue } from "@/lib/domain/validate-plan";
import type { PlanEntry } from "@/lib/plan/types";

/** Eventos que el servidor manda por SSE en el chat del plan. */
export type PlanAgentEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_started"; name: string }
  | { type: "plan_updated"; entries: PlanEntry[]; warnings: PlanIssue[]; changedIds: string[] }
  | { type: "diet_updated"; version: number }
  | { type: "done"; conversationId: string }
  | { type: "error"; message: string };

export const encodePlanSse = (event: PlanAgentEvent) =>
  `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;

export function parsePlanSseBlock(block: string): PlanAgentEvent | null {
  const data = block
    .split("\n")
    .find((l) => l.startsWith("data:"))
    ?.slice(5)
    .trim();
  if (!data) return null;
  try {
    const parsed = JSON.parse(data) as PlanAgentEvent;
    return typeof parsed?.type === "string" ? parsed : null;
  } catch {
    return null;
  }
}

/** Texto que se muestra mientras corre cada herramienta. */
export const TOOL_LABELS: Record<string, string> = {
  search_recipes: "Revisando tus recetas…",
  get_recent_meals: "Mirando lo que comieron últimamente…",
  get_participants: "Revisando quiénes comen y qué restricciones hay…",
  get_ingredient_info: "Chequeando ingredientes…",
  propose_recipe: "Inventando una receta nueva…",
  set_plan: "Armando el plan…",
  update_entries: "Ajustando el plan…",
  propose_swaps: "Buscando reemplazos…",
  apply_swap: "Aplicando el cambio…",
  update_meal: "Ajustando la comida…",
  update_rule: "Ajustando la regla…",
  answer_question: "Anotando tu respuesta…",
};
