"use client";

import { useEffect, useRef } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Composer } from "@/components/assistant/composer";
import { Message } from "@/components/assistant/message";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { VoiceRecorder } from "@/components/voice/voice-recorder";
import type { Proposal } from "@/lib/ai/assistant/events";
import { useAssistantChat, type ChatContext } from "@/lib/hooks/use-assistant-chat";
import { useSpeak } from "@/lib/hooks/use-speak";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  /** Texto del chip: "Paso 4 · Dorar el pollo". */
  stepLabel: string;
  /** Contexto actual de la sesión (receta, paso, porciones, timers), leído al enviar cada pregunta. */
  getContext: () => ChatContext;
  /** "Aplicar en esta sesión": los cambios propuestos van a los ajustes de la sesión, no a la receta. */
  onApplyInSession: (proposal: Extract<Proposal, { kind: "recipe_change" }>) => void;
};

/**
 * Panel "Preguntale" sobre el paso que se está cocinando. Una sola conversación por sesión de cocina
 * (el panel queda montado). Los timers siguen corriendo y al cerrar se vuelve al mismo paso.
 */
export function AskSheet({
  open,
  onOpenChange,
  groupId,
  stepLabel,
  getContext,
  onApplyInSession,
}: Props) {
  const chat = useAssistantChat({ groupId, getContext });
  const speech = useSpeak();
  const bottom = useRef<HTMLDivElement | null>(null);
  const wasBusy = useRef(false);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [chat.messages, open]);

  // Cuando termina de responder, se lee en voz alta (si está activado).
  useEffect(() => {
    if (wasBusy.current && !chat.busy) {
      const last = chat.messages.at(-1);
      if (last?.role === "assistant" && !last.failed) speech.speak(last.text);
    }
    wasBusy.current = chat.busy;
  }, [chat.busy, chat.messages, speech]);

  // Si la persona vuelve a hablar o cierra el panel, se corta la lectura.
  function ask(text: string) {
    speech.cancel();
    void chat.send(text, []);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) speech.cancel();
        onOpenChange(next);
      }}
    >
      <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-3xl">
        <SheetHeader className="pb-0">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle>Preguntale</SheetTitle>
            {speech.supported ? (
              <button
                type="button"
                aria-pressed={speech.enabled}
                aria-label={
                  speech.enabled
                    ? "Desactivar respuesta en voz alta"
                    : "Activar respuesta en voz alta"
                }
                onClick={() => speech.setEnabled(!speech.enabled)}
                className="flex size-11 items-center justify-center rounded-full bg-surface-2"
              >
                {speech.enabled ? (
                  <Volume2 className="size-5" aria-hidden="true" />
                ) : (
                  <VolumeX className="size-5" aria-hidden="true" />
                )}
              </button>
            ) : null}
          </div>
          <SheetDescription className="sr-only">
            Hacé una pregunta sobre el paso que estás cocinando.
          </SheetDescription>
          <p className="w-fit max-w-full truncate rounded-full bg-hero px-3 py-1.5 text-[13px] font-semibold">
            {stepLabel}
          </p>
        </SheetHeader>

        <div
          className="flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto px-4"
          aria-live="polite"
        >
          {chat.messages.length === 0 ? (
            <p className="py-2 text-sm text-muted">
              Tocá el botón y preguntá lo que necesites. Te respondo corto.
            </p>
          ) : null}
          {chat.messages.map((m) => (
            <Message key={m.id} message={m} groupId={groupId} onApplyInSession={onApplyInSession} />
          ))}
          <div ref={bottom} />
        </div>

        <div className="flex flex-col gap-1 px-2">
          <VoiceRecorder autoSend idleLabel="Tocá y hablá" onTranscript={ask} />
        </div>
        <Composer groupId={groupId} disabled={chat.busy} hideVoice onSend={(text) => ask(text)} />
      </SheetContent>
    </Sheet>
  );
}
