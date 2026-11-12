"use client";

import { useState } from "react";
import { Minus, Pencil, Plus } from "lucide-react";
import { PillButton } from "@/components/shared/pill-button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceRecorder } from "@/components/voice/voice-recorder";
import type { FoodProfileData, ProfileChange } from "@/lib/schemas/food-profile";
import { Chip } from "./chips";

type Props = {
  proposed: FoodProfileData;
  summary: string;
  changes: ProfileChange[];
  openQuestions: string[];
  busy: boolean;
  error?: string | null;
  onSummaryChange: (summary: string) => void;
  onAnswer: (question: string, answer: string) => void;
  onSave: () => void;
  onDiscard: () => void;
};

const OP_ICON = { add: Plus, change: Pencil, remove: Minus } as const;

function QuestionCard({
  question,
  busy,
  onAnswer,
}: {
  question: string;
  busy: boolean;
  onAnswer: (answer: string) => void;
}) {
  const [other, setOther] = useState(false);
  const [text, setText] = useState("");
  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-accent/50 bg-surface p-3">
      <p className="text-[15px] font-medium">{question}</p>
      <div className="flex flex-wrap gap-2">
        <PillButton size="md" disabled={busy} onClick={() => onAnswer("Sí")}>
          Sí
        </PillButton>
        <PillButton size="md" variant="outline" disabled={busy} onClick={() => onAnswer("No")}>
          No
        </PillButton>
        <PillButton size="md" variant="soft" disabled={busy} onClick={() => setOther((v) => !v)}>
          Otra respuesta
        </PillButton>
      </div>
      {other ? (
        <div className="flex flex-col gap-2">
          <Textarea
            aria-label="Tu respuesta"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribí tu respuesta"
            className="min-h-20 text-base"
          />
          <PillButton
            size="md"
            disabled={busy || !text.trim()}
            onClick={() => onAnswer(text.trim())}
          >
            Responder
          </PillButton>
          <VoiceRecorder autoSend idleLabel="O contestá hablando" onTranscript={onAnswer} />
        </div>
      ) : null}
    </li>
  );
}

/** Revisión del borrador: resumen editable, cambios, perfil propuesto y preguntas abiertas. */
export function DraftReview({
  proposed,
  summary,
  changes,
  openQuestions,
  busy,
  error,
  onSummaryChange,
  onAnswer,
  onSave,
  onDiscard,
}: Props) {
  const forbidden = proposed.restrictions.filter((r) => r.severity === "forbidden");
  const limited = proposed.restrictions.filter((r) => r.severity === "limit");
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-[26px] leading-tight font-normal">Revisá tu perfil</h2>
        <p className="mt-1 text-sm text-muted">
          Todavía no se guardó nada. Corregí lo que haga falta y guardalo.
        </p>
      </div>

      <section className="grid gap-2">
        <label htmlFor="profile-summary" className="text-sm font-medium">
          Resumen
        </label>
        <Textarea
          id="profile-summary"
          value={summary}
          onChange={(e) => onSummaryChange(e.target.value)}
          className="min-h-28 text-base"
        />
      </section>

      {changes.length > 0 ? (
        <section className="flex flex-col gap-1.5" aria-label="Cambios">
          <h3 className="text-xs font-bold tracking-[0.1em] text-muted">QUÉ CAMBIÓ</h3>
          <ul className="flex flex-col gap-1.5">
            {changes.map((c, i) => {
              const Icon = OP_ICON[c.op];
              return (
                <li key={i} className="flex gap-2 text-sm">
                  <Icon className="mt-0.5 size-4 flex-none text-accent" aria-hidden="true" />
                  <span>{c.text}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {forbidden.length + limited.length > 0 ? (
        <section className="flex flex-col gap-2">
          {forbidden.length > 0 ? (
            <>
              <h3 className="text-xs font-bold tracking-[0.1em] text-muted">NO COMÉS</h3>
              <div className="flex flex-wrap gap-2">
                {forbidden.map((r) => (
                  <Chip
                    key={`${r.type}:${r.target}`}
                    tone="forbidden"
                    label={r.target}
                    title={r.reason}
                  />
                ))}
              </div>
            </>
          ) : null}
          {limited.length > 0 ? (
            <>
              <h3 className="text-xs font-bold tracking-[0.1em] text-muted">LIMITÁS</h3>
              <div className="flex flex-wrap gap-2">
                {limited.map((r) => (
                  <Chip
                    key={`${r.type}:${r.target}`}
                    tone="limit"
                    label={r.limit ? `${r.target} · ${r.limit}` : r.target}
                  />
                ))}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {openQuestions.length > 0 ? (
        <section className="flex flex-col gap-2" aria-label="Preguntas">
          <h3 className="text-xs font-bold tracking-[0.1em] text-muted">TE QUERÍAMOS PREGUNTAR</h3>
          <ul className="flex flex-col gap-2">
            {openQuestions.map((q) => (
              <QuestionCard
                key={q}
                question={q}
                busy={busy}
                onAnswer={(answer) => onAnswer(q, answer)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-danger-soft">
          {error}
        </p>
      ) : null}
      <PillButton fullWidth disabled={busy} onClick={onSave}>
        {busy ? "Un segundo…" : "Guardar perfil"}
      </PillButton>
      <PillButton fullWidth variant="outline" size="md" disabled={busy} onClick={onDiscard}>
        Descartar
      </PillButton>
    </div>
  );
}
