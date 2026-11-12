"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, History, Plus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useAssistantChat,
  type ChatContext,
  type ChatMessage,
  type MentionRef,
} from "@/lib/hooks/use-assistant-chat";
import { Composer } from "./composer";
import { Message } from "./message";

export type ConversationSummary = { id: string; title: string | null; last_message_at: string };

type Props = {
  groupId: string;
  context: ChatContext;
  initialMentions?: MentionRef[];
  initialMessages?: ChatMessage[];
  initialConversationId?: string | null;
  conversations: ConversationSummary[];
  /** A dónde vuelve la flecha del header. */
  backHref: string;
};

const SUGGESTIONS = ["¿Cuánto dura en la heladera?", "¿Con qué lo acompaño?", "¿Se puede freezar?"];

const dayFormat = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

/** Pantalla "Preguntale": chat con el asistente, con citas de recetas y propuestas para confirmar. */
export function AssistantChat({
  groupId,
  context,
  initialMentions = [],
  initialMessages = [],
  initialConversationId = null,
  conversations,
  backHref,
}: Props) {
  const router = useRouter();
  const [historyOpen, setHistoryOpen] = useState(false);
  const chat = useAssistantChat({
    groupId,
    initialMessages,
    initialConversationId,
    getContext: () => context,
  });
  const bottom = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.messages]);

  const empty = chat.messages.length === 0;

  return (
    <>
      <header className="flex flex-none items-center gap-2 border-b border-border px-3 py-3">
        <Link
          href={backHref}
          aria-label="Volver"
          className="flex size-11 items-center justify-center rounded-full"
        >
          <ChevronLeft className="size-6" aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[26px] leading-[1.05] font-normal">Preguntale</h1>
          <p className="text-xs text-muted">Conoce tus recetas, tu plan y lo que compraste</p>
        </div>
        <button
          type="button"
          aria-label="Conversaciones anteriores"
          onClick={() => setHistoryOpen(true)}
          className="flex size-11 items-center justify-center rounded-full bg-surface"
        >
          <History className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Nueva pregunta"
          onClick={() => {
            chat.reset();
            router.replace(`/g/${groupId}/preguntar`);
          }}
          className="flex size-11 items-center justify-center rounded-full bg-surface"
        >
          <Plus className="size-5" aria-hidden="true" />
        </button>
      </header>

      <main
        className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 pt-3.5 pb-3"
        aria-live="polite"
      >
        {empty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="font-display text-[26px] leading-tight">¿Qué querés saber?</p>
            <p className="max-w-[260px] text-sm text-muted">
              Preguntame por reemplazos, conservación, freezer o cómo combinar tus recetas. Escribí
              @ para citar una.
            </p>
          </div>
        ) : null}
        {chat.messages.map((m) => (
          <Message key={m.id} message={m} groupId={groupId} />
        ))}
        {!chat.busy && chat.messages.length > 0 && chat.messages.at(-1)?.role === "assistant" ? (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void chat.send(s, [])}
                className="min-h-9 rounded-full border border-border px-3 text-[13px] text-foreground/90"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
        <div ref={bottom} />
      </main>

      <Composer
        groupId={groupId}
        disabled={chat.busy}
        initialMentions={initialMentions}
        onSend={(text, mentions) => void chat.send(text, mentions)}
      />

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Conversaciones anteriores</SheetTitle>
            <SheetDescription>Solo las ves vos.</SheetDescription>
          </SheetHeader>
          <ul className="flex max-h-[60dvh] flex-col gap-2 overflow-y-auto px-4 pb-6">
            {conversations.length === 0 ? (
              <li className="text-sm text-muted">Todavía no hiciste preguntas.</li>
            ) : null}
            {conversations.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/g/${groupId}/preguntar?c=${c.id}`}
                  onClick={() => setHistoryOpen(false)}
                  className="flex min-h-14 flex-col justify-center rounded-2xl border border-border bg-surface px-4"
                >
                  <span className="truncate text-[15px] font-semibold">
                    {c.title ?? "Pregunta"}
                  </span>
                  <span className="text-xs text-muted">
                    {dayFormat.format(new Date(c.last_message_at))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
