"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Send, X } from "lucide-react";
import { VoiceRecorder } from "@/components/voice/voice-recorder";
import type { MentionRef } from "@/lib/hooks/use-assistant-chat";
import { filterMentionCandidates } from "@/lib/domain/mention-search";
import { listRecipesForMention, type MentionRecipe } from "@/lib/recipes/actions";
import { MentionPicker } from "./mention-picker";

type Props = {
  groupId: string;
  disabled?: boolean;
  initialMentions?: MentionRef[];
  /** Si es true, solo se muestra el campo de texto (sin voz): lo usa el panel del modo cocinar con su propio botón. */
  hideVoice?: boolean;
  onSend: (text: string, mentions: MentionRef[]) => void;
};

const MAX_MENTIONS = 5;
// Un "@" al principio o después de un espacio, seguido de lo que se va escribiendo.
const MENTION_TOKEN = /(?:^|\s)@([^\s@]*)$/;

/** Campo de pregunta con citas de recetas (@), chips y dictado por voz. */
export function Composer({ groupId, disabled, initialMentions = [], hideVoice, onSend }: Props) {
  const [value, setValue] = useState("");
  const [chips, setChips] = useState<MentionRef[]>(initialMentions);
  const [query, setQuery] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<MentionRecipe[] | null>(null);
  const [active, setActive] = useState(0);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);

  // Las recetas del grupo se cargan una vez, al abrir el primer "@", y se filtran en el cliente.
  useEffect(() => {
    if (query === null || catalog !== null) return;
    let cancelled = false;
    listRecipesForMention({ groupId }).then((res) => {
      if (!cancelled) setCatalog(res.ok ? res.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, [query, catalog, groupId]);

  const results = query === null || catalog === null ? [] : filterMentionCandidates(catalog, query);

  function onChange(next: string) {
    setValue(next);
    const token = next.match(MENTION_TOKEN);
    setQuery(token ? (token[1] ?? "") : null);
    setActive(0);
  }

  function pick(recipe: MentionRecipe) {
    setChips((prev) =>
      prev.some((c) => c.id === recipe.id) || prev.length >= MAX_MENTIONS
        ? prev
        : [...prev, { id: recipe.id, title: recipe.title }],
    );
    setValue((v) => v.replace(MENTION_TOKEN, (m) => (m.startsWith(" ") ? " " : "")));
    setQuery(null);
    input.current?.focus();
  }

  function send() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text, chips);
    setValue("");
    setChips([]);
    setQuery(null);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (query !== null && results.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => (a + 1) % results.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => (a - 1 + results.length) % results.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const chosen = results[active];
        if (chosen) pick(chosen);
        return;
      }
    }
    if (e.key === "Escape") setQuery(null);
    if (e.key === "Enter") {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="relative flex flex-none flex-col gap-2 border-t border-border px-4 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
      {query !== null ? (
        <MentionPicker results={results} activeIndex={active} onPick={pick} onHover={setActive} />
      ) : null}

      {voiceOpen ? (
        <div className="rounded-2xl bg-surface p-3">
          <VoiceRecorder
            confirmLabel="Usar este texto"
            idleLabel="Tocá y hacé tu pregunta"
            onTranscript={(text) => {
              onChange(`${value ? `${value} ` : ""}${text}`);
              setVoiceOpen(false);
              input.current?.focus();
            }}
          />
          <button
            type="button"
            onClick={() => setVoiceOpen(false)}
            className="mx-auto mt-1 flex min-h-11 items-center gap-1 text-sm text-muted"
          >
            <X className="size-4" aria-hidden="true" /> Cerrar
          </button>
        </div>
      ) : null}

      {chips.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Recetas citadas">
          {chips.map((c) => (
            <li
              key={c.id}
              className="inline-flex min-h-8 max-w-full items-center gap-1 rounded-full bg-accent pr-1 pl-3 text-[13px] font-semibold text-accent-foreground"
            >
              <span className="truncate">{c.title}</span>
              <button
                type="button"
                aria-label={`Quitar ${c.title}`}
                onClick={() => setChips((prev) => prev.filter((x) => x.id !== c.id))}
                className="flex size-7 items-center justify-center rounded-full"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center gap-2">
        <label className="flex min-h-[50px] min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-surface pr-1.5 pl-4">
          <span className="sr-only">Escribí tu pregunta. Usá @ para citar una receta</span>
          <input
            ref={input}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Preguntá lo que quieras…"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
          />
          <button
            type="button"
            aria-label="Citar una receta"
            onClick={() => {
              onChange(`${value}${value && !value.endsWith(" ") ? " " : ""}@`);
              input.current?.focus();
            }}
            className="flex size-[38px] flex-none items-center justify-center rounded-full bg-surface-2 text-[17px] font-bold text-accent"
          >
            @
          </button>
        </label>
        {!hideVoice ? (
          <button
            type="button"
            aria-label="Preguntar por voz"
            onClick={() => setVoiceOpen((v) => !v)}
            className="flex size-[50px] flex-none items-center justify-center rounded-full bg-surface-2"
          >
            <Mic className="size-5" aria-hidden="true" />
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Enviar pregunta"
          disabled={disabled || !value.trim()}
          onClick={send}
          className="flex size-[50px] flex-none items-center justify-center rounded-full bg-accent text-accent-foreground disabled:opacity-50"
        >
          <Send className="size-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
