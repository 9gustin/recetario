"use client";

import { useCallback, useRef, useState } from "react";
import { parseSseBlock, type Proposal } from "@/lib/ai/assistant/events";

export type MentionRef = { id: string; title: string };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  mentions: MentionRef[];
  proposals: Proposal[];
  /** Herramienta en uso mientras el asistente piensa (para mostrar "Revisando la receta…"). */
  working?: string | null;
  failed?: boolean;
};

export type ChatContext = {
  origin: "home" | "recipe" | "cooking";
  recipeId?: string;
  step?: number;
  servings?: number;
  timers?: { label: string; remaining_seconds: number }[];
};

type Options = {
  groupId: string;
  initialMessages?: ChatMessage[];
  initialConversationId?: string | null;
  /** Se llama antes de cada envío para tomar el contexto actual (paso, timers…). */
  getContext?: () => ChatContext;
  onConversation?: (id: string) => void;
};

const TOOL_LABELS: Record<string, string> = {
  get_recipe: "Mirando la receta…",
  search_recipes: "Buscando en tus recetas…",
  get_ingredient_info: "Consultando conservación…",
  check_compatibility: "Chequeando tus restricciones…",
  propose_recipe_change: "Preparando el cambio…",
  propose_note: "Preparando la nota…",
};

let counter = 0;
const nextId = () => `m${Date.now()}-${counter++}`;

/** Chat con el asistente: manda la pregunta y va armando la respuesta con el streaming SSE. */
export function useAssistantChat({
  groupId,
  initialMessages = [],
  initialConversationId = null,
  getContext,
  onConversation,
}: Options) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const patchLast = useCallback((fn: (m: ChatMessage) => ChatMessage) => {
    setMessages((prev) =>
      prev.length ? [...prev.slice(0, -1), fn(prev[prev.length - 1]!)] : prev,
    );
  }, []);

  const send = useCallback(
    async (text: string, mentions: MentionRef[] = []) => {
      const message = text.trim();
      if (!message || busy) return;
      setBusy(true);
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "user", text: message, mentions, proposals: [] },
        {
          id: nextId(),
          role: "assistant",
          text: "",
          mentions: [],
          proposals: [],
          working: "Pensando…",
        },
      ]);

      const controller = new AbortController();
      abort.current = controller;
      try {
        const res = await fetch("/api/ai/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupId,
            conversationId: conversationId ?? undefined,
            message,
            mentions: mentions.map((m) => m.id),
            context: getContext?.() ?? { origin: "home" },
          }),
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
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() ?? "";
          for (const block of blocks) {
            const event = parseSseBlock(block);
            if (!event) continue;
            if (event.type === "text_delta")
              patchLast((m) => ({ ...m, text: m.text + event.text, working: null }));
            else if (event.type === "tool_started")
              patchLast((m) => ({ ...m, working: TOOL_LABELS[event.name] ?? "Pensando…" }));
            else if (event.type === "proposal")
              patchLast((m) => ({ ...m, proposals: [...m.proposals, event.proposal] }));
            else if (event.type === "done") {
              setConversationId(event.conversationId);
              onConversation?.(event.conversationId);
              patchLast((m) => ({ ...m, working: null }));
            } else if (event.type === "error") {
              patchLast((m) => ({
                ...m,
                working: null,
                failed: true,
                text: m.text || event.message,
              }));
            }
          }
        }
        patchLast((m) => ({ ...m, working: null }));
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
    [busy, conversationId, getContext, groupId, onConversation, patchLast],
  );

  const reset = useCallback(() => {
    abort.current?.abort();
    setMessages([]);
    setConversationId(null);
    setBusy(false);
  }, []);

  return { messages, conversationId, busy, send, reset };
}
