"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PillButton } from "@/components/shared/pill-button";
import { VoiceRecorder } from "@/components/voice/voice-recorder";
import { slotLabel, type MealSlot } from "@/lib/domain/meal-slots";
import { logMeal } from "@/lib/diet-plan/actions";
import { dayLabel } from "@/lib/domain/week";

type Status = "followed" | "changed" | "allowance";
type Option = { date: string; slot: MealSlot; formula: string };

/** Registrar una comida con un toque; "o contá qué comiste" sugiere el estado y la persona confirma. */
export function LogMeal({
  options,
  initial,
  allowancesLeft,
}: {
  options: Option[];
  initial: number;
  allowancesLeft: number;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(initial);
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [voice, setVoice] = useState(false);
  const [suggest, setSuggest] = useState<{ status: Status; phrase: string } | null>(null);
  const [classifying, setClassifying] = useState(false);
  const current = options[index];

  if (!current) return <p className="text-sm text-muted">No hay comidas para registrar.</p>;

  function save(status: Status, note?: string, aiSuggested?: string) {
    if (!current) return;
    start(async () => {
      const res = await logMeal({
        date: current.date,
        slot: current.slot,
        status,
        note,
        aiSuggested,
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success("¡Registrado!");
      setSuggest(null);
      setText("");
      router.refresh();
    });
  }

  async function classify(value: string) {
    if (!current) return;
    setClassifying(true);
    try {
      const res = await fetch("/api/ai/meal-logs/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value, formula: current.formula }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        status?: Status;
        phrase?: string;
        error?: string;
      };
      if (!res.ok || !body.status) throw new Error(body.error ?? "No pudimos sugerir un estado.");
      setSuggest({ status: body.status, phrase: body.phrase ?? "" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos sugerir un estado.");
    } finally {
      setClassifying(false);
    }
  }

  const statusLabel = {
    followed: "Cumplí",
    changed: "Cambié algo",
    allowance: "Permitido",
  } as const;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 rounded-2xl bg-hero p-4">
        <label htmlFor="meal-select" className="text-xs font-bold tracking-wide uppercase">
          Qué comida
        </label>
        <select
          id="meal-select"
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
          className="min-h-11 rounded-xl border border-border bg-background px-3 text-[15px]"
        >
          {options.map((o, i) => (
            <option key={`${o.date}-${o.slot}`} value={i}>
              {dayLabel(o.date)} · {slotLabel(o.slot)}
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm">{current.formula}</p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <PillButton disabled={pending} onClick={() => save("followed")}>
          Cumplí
        </PillButton>
        <PillButton variant="soft" disabled={pending} onClick={() => save("changed")}>
          Cambié algo
        </PillButton>
        <PillButton
          variant="outline"
          disabled={pending || allowancesLeft <= 0}
          onClick={() => save("allowance")}
        >
          Permitido
        </PillButton>
        {allowancesLeft <= 0 ? (
          <p className="text-xs text-muted">Ya usaste todos los permitidos de esta semana.</p>
        ) : null}
      </div>

      <section className="flex flex-col gap-2" aria-label="Contá qué comiste">
        <label htmlFor="meal-text" className="text-sm font-medium">
          O contá qué comiste
        </label>
        {voice ? (
          <VoiceRecorder
            idleLabel="Tocá y contame"
            confirmLabel="Usar este texto"
            onTranscript={(t) => {
              setVoice(false);
              setText(t);
              void classify(t);
            }}
          />
        ) : (
          <>
            <input
              id="meal-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Comí una tarta de verdura"
              className="min-h-12 rounded-full border border-border bg-surface px-4 text-[15px] outline-none"
            />
            <div className="flex gap-2">
              <PillButton
                size="md"
                variant="soft"
                disabled={classifying || text.trim().length < 2}
                onClick={() => void classify(text)}
              >
                {classifying ? <Loader2 className="animate-spin" /> : null} Sugerir estado
              </PillButton>
              <PillButton size="md" variant="outline" onClick={() => setVoice(true)}>
                Hablar
              </PillButton>
            </div>
          </>
        )}
        {suggest ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-border p-3.5" role="status">
            <p className="text-sm">
              <span className="font-semibold">{statusLabel[suggest.status]}.</span> {suggest.phrase}
            </p>
            <PillButton
              size="md"
              disabled={pending}
              onClick={() => save(suggest.status, text, suggest.status)}
            >
              Confirmar
            </PillButton>
          </div>
        ) : null}
      </section>
    </div>
  );
}
