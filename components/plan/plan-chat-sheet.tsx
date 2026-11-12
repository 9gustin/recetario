"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Mic, Send, X } from "lucide-react";
import { VoiceRecorder } from "@/components/voice/voice-recorder";
import { usePlanChat } from "@/lib/hooks/use-plan-chat";
import type { PlanAgentEvent } from "@/lib/ai/plan-agent/events";
import { cn } from "@/lib/utils";

type Update = Extract<PlanAgentEvent, { type: "plan_updated" }>;

const MENU_SUGGESTIONS = [
  "Tarta de pollo y tarta de espinaca",
  "Pollo con ensalada 3 veces, sugerime ensaladas",
  "Carne con puré, hecha en la olla",
  "Ideas rápidas para cenar",
];

const SUGGESTIONS = [
  "Armame la semana",
  "Solo cenas",
  "El jueves comemos afuera",
  "Quiero pescado 2 veces",
  "Recetas de menos de 30 min",
];

// Tres alturas: la grilla del plan queda visible arriba en las dos primeras.
const HEIGHTS = ["h-[34dvh]", "h-[56dvh]", "h-[86dvh]"] as const;

/** Panel inferior (no modal) para pedirle al planificador que arme o ajuste la semana. */
export function PlanChatSheet({
  planId,
  open,
  onClose,
  onPlanUpdated,
  menu = false,
}: {
  planId: string;
  open: boolean;
  onClose: () => void;
  onPlanUpdated: (update: Update) => void;
  /** Modo "Mis comidas": un listado sin días ni momentos. */
  menu?: boolean;
}) {
  const { messages, busy, send } = usePlanChat({ planId, onPlanUpdated });
  const [text, setText] = useState("");
  const [height, setHeight] = useState(1);
  const [voice, setVoice] = useState(false);
  const end = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [messages]);

  if (!open) return null;

  function submit(value: string) {
    const v = value.trim();
    if (!v || busy) return;
    setText("");
    setVoice(false);
    void send(v);
  }

  return (
    <section
      role="dialog"
      aria-label="Armar el plan con IA"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md flex-col rounded-t-3xl border border-border bg-background shadow-2xl",
        HEIGHTS[height],
      )}
    >
      <header className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
        <h2 className="font-display text-xl font-normal">
          {menu ? "Contame qué querés comer" : "Armar con IA"}
        </h2>
        <div className="flex items-center">
          <button
            type="button"
            aria-label={height === 2 ? "Achicar el panel" : "Agrandar el panel"}
            onClick={() => setHeight((h) => (h === 2 ? 0 : h + 1))}
            className="flex size-11 items-center justify-center rounded-full"
          >
            {height === 2 ? <ChevronDown className="size-5" /> : <ChevronUp className="size-5" />}
          </button>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="flex size-11 items-center justify-center rounded-full"
          >
            <X className="size-5" />
          </button>
        </div>
      </header>

      <div
        className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 pb-2"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted">
              {menu
                ? "Decime las comidas que tenés en mente y las anoto. Probá con:"
                : "Contame qué querés y armo el borrador. Probá con:"}
            </p>
            <ul className="flex flex-wrap gap-2">
              {(menu ? MENU_SUGGESTIONS : SUGGESTIONS).map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => setText((t) => (t ? `${t}. ${s}` : s))}
                    className="min-h-11 rounded-full border border-border bg-surface px-3.5 text-[13px] font-semibold"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          messages.map((m) =>
            m.role === "user" ? (
              <p
                key={m.id}
                className="max-w-[84%] self-end rounded-[18px_18px_4px_18px] bg-hero px-3.5 py-2.5 text-sm"
              >
                {m.text}
              </p>
            ) : (
              <div
                key={m.id}
                className={cn(
                  "flex max-w-[92%] flex-col gap-1.5 rounded-[18px_18px_18px_4px] bg-surface px-3.5 py-3 text-sm leading-[1.5]",
                  m.failed && "border border-danger-soft/60",
                )}
              >
                {m.text ? <p className="whitespace-pre-wrap">{m.text}</p> : null}
                {m.working ? (
                  <p className="flex items-center gap-2 text-muted" role="status">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {m.working}
                  </p>
                ) : null}
              </div>
            ),
          )
        )}
        <div ref={end} />
      </div>

      <div className="border-t border-border px-4 py-3">
        {voice ? (
          <VoiceRecorder
            idleLabel="Tocá para contarme qué querés"
            confirmLabel="Pedir esto"
            onTranscript={(t) => submit(t)}
          />
        ) : (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit(text);
            }}
          >
            <label className="sr-only" htmlFor="plan-chat-input">
              Qué querés pedirle al planificador
            </label>
            <input
              id="plan-chat-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Armame la semana…"
              disabled={busy}
              className="min-h-12 min-w-0 flex-1 rounded-full border border-border bg-surface px-4 text-[15px] outline-none"
            />
            <button
              type="button"
              aria-label="Dictar por voz"
              onClick={() => setVoice(true)}
              disabled={busy}
              className="flex size-12 flex-none items-center justify-center rounded-full border border-border"
            >
              <Mic className="size-5" />
            </button>
            <button
              type="submit"
              aria-label="Enviar"
              disabled={busy || !text.trim()}
              className="flex size-12 flex-none items-center justify-center rounded-full bg-accent text-accent-foreground disabled:opacity-50"
            >
              <Send className="size-5" />
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
