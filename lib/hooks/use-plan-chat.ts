"use client";

import { useCallback, useRef, useState } from "react";
import { parsePlanSseBlock, TOOL_LABELS, type PlanAgentEvent } from "@/lib/ai/plan-agent/events";

export type PlanChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  working?: string | null;
  failed?: boolean;
};

type PlanUpdate = Extract<PlanAgentEvent, { type: "plan_updated" }>;

let counter = 0;
const nextId = () => `p${Date.now()}-${counter++}`;

/** Chat con el planificador: manda el pedido y va aplicando el streaming SSE (texto y cambios del plan). */
export function usePlanChat({
  planId,
  onPlanUpdated,
  endpoint,
  onDietUpdated,
}: {
  planId: string | null;
  onPlanUpdated?: (update: PlanUpdate) => void;
  /** Por defecto, el chat del plan semanal; el plan de alimentación usa el suyo. */
  endpoint?: string;
  onDietUpdated?: (version: number) => void;
}) {
  const [messages, setMessages] = useState<PlanChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const patchLast = useCallback((fn: (m: PlanChatMessage) => PlanChatMessage) => {
    setMessages((prev) =>
      prev.length ? [...prev.slice(0, -1), fn(prev[prev.length - 1]!)] : prev,
    );
  }, []);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy || !planId) return;
      setBusy(true);
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "user", text: message },
        { id: nextId(), role: "assistant", text: "", working: "Pensando…" },
      ]);
      const controller = new AbortController();
      abort.current = controller;
      try {
        const res = await fetch(endpoint ?? `/api/ai/plans/${planId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, conversationId: conversationId ?? undefined }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          patchLast((m) => ({
            ...m,
            working: null,
            failed: true,
            text: body.error ?? "No pudimos responder. Probá de nuevo.",
          }));
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finished = false;
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() ?? "";
          for (const block of blocks) {
            const event = parsePlanSseBlock(block);
            if (!event) continue;
            if (event.type === "text_delta")
              patchLast((m) => ({ ...m, text: m.text + event.text, working: null }));
            else if (event.type === "tool_started")
              patchLast((m) => ({ ...m, working: TOOL_LABELS[event.name] ?? "Pensando…" }));
            else if (event.type === "plan_updated") onPlanUpdated?.(event);
            else if (event.type === "diet_updated") onDietUpdated?.(event.version);
            else if (event.type === "done") {
              finished = true;
              setConversationId(event.conversationId);
            } else if (event.type === "error") {
              finished = true;
              patchLast((m) => ({
                ...m,
                working: null,
                failed: true,
                text: m.text || event.message,
              }));
            }
          }
        }
        // El servidor cortó antes de terminar (por ejemplo por límite de tiempo): se avisa en vez de quedar colgado.
        if (!finished) {
          patchLast((m) => ({
            ...m,
            working: null,
            failed: true,
            text:
              m.text ||
              "Se cortó antes de terminar. Lo que ya se armó quedó guardado en el plan: pedime que lo complete.",
          }));
        } else patchLast((m) => ({ ...m, working: null }));
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          patchLast((m) => ({
            ...m,
            working: null,
            failed: true,
            text: m.text || "Se cortó la conexión. Probá de nuevo.",
          }));
        }
      } finally {
        setBusy(false);
        abort.current = null;
      }
    },
    [busy, conversationId, endpoint, onDietUpdated, onPlanUpdated, patchLast, planId],
  );

  return { messages, busy, send };
}
