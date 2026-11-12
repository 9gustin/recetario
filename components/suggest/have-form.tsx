"use client";

import { useState } from "react";
import { Loader2, Mic, Plus, X } from "lucide-react";
import { PillButton } from "@/components/shared/pill-button";
import { VoiceRecorder } from "@/components/voice/voice-recorder";
import { splitIngredients } from "@/lib/domain/coverage";
import type { SuggestCard, SuggestFilters } from "@/lib/schemas/suggest";
import { cn } from "@/lib/utils";
import { SuggestResults } from "./results";

const FILTERS: { key: keyof SuggestFilters; label: string }[] = [
  { key: "quick", label: "Menos de 30 min" },
  { key: "noOven", label: "Sin horno" },
  { key: "light", label: "Liviano" },
];

/** "¿Qué tenés?": ingredientes como chips (a mano o por voz), antojo opcional y filtros rápidos. */
export function HaveForm({
  groupId,
  initialCraving = "",
}: {
  groupId: string;
  initialCraving?: string;
}) {
  const [items, setItems] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [craving, setCraving] = useState(initialCraving);
  const [filters, setFilters] = useState<SuggestFilters>({
    quick: false,
    noOven: false,
    light: false,
  });
  const [voice, setVoice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<SuggestCard[] | null>(null);

  function add(text: string) {
    const next = splitIngredients(text);
    if (next.length === 0) return;
    setItems((prev) => [
      ...prev,
      ...next.filter((n) => !prev.some((p) => p.toLowerCase() === n.toLowerCase())),
    ]);
    setDraft("");
  }

  async function search() {
    const pending = draft.trim() ? [...items, ...splitIngredients(draft)] : items;
    setItems(pending);
    setDraft("");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          mode: "have",
          have: pending,
          craving: craving || undefined,
          filters,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        cards?: SuggestCard[];
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? "No pudimos buscar ideas.");
      setCards(body.cards ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos buscar ideas.");
    } finally {
      setLoading(false);
    }
  }

  const canSearch = (items.length > 0 || draft.trim() || craving.trim()) && !loading;

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3 px-5" aria-labelledby="have-title">
        <h2 id="have-title" className="font-display text-2xl font-normal">
          ¿Qué tenés en casa?
        </h2>

        {items.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="Ingredientes">
            {items.map((i) => (
              <li
                key={i}
                className="flex min-h-9 items-center gap-1.5 rounded-full bg-hero pr-1 pl-3.5 text-sm font-semibold"
              >
                {i}
                <button
                  type="button"
                  aria-label={`Sacar ${i}`}
                  onClick={() => setItems((prev) => prev.filter((p) => p !== i))}
                  className="flex size-8 items-center justify-center rounded-full"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {voice ? (
          <VoiceRecorder
            idleLabel="Tocá para decir qué tenés"
            confirmLabel="Agregar"
            onTranscript={(t) => {
              add(t);
              setVoice(false);
            }}
          />
        ) : (
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="have-input">
              Agregar un ingrediente
            </label>
            <input
              id="have-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add(draft);
                }
              }}
              placeholder="Pollo, zapallitos, huevos…"
              className="min-h-12 min-w-0 flex-1 rounded-full border border-border bg-surface px-4 text-[15px] outline-none"
            />
            <button
              type="button"
              aria-label="Agregar ingrediente"
              onClick={() => add(draft)}
              className="flex size-12 flex-none items-center justify-center rounded-full border border-border"
            >
              <Plus className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Dictar por voz"
              onClick={() => setVoice(true)}
              className="flex size-12 flex-none items-center justify-center rounded-full border border-border"
            >
              <Mic className="size-5" />
            </button>
          </div>
        )}

        <label htmlFor="craving" className="text-sm font-medium">
          ¿Algún antojo? (opcional)
        </label>
        <input
          id="craving"
          value={craving}
          onChange={(e) => setCraving(e.target.value)}
          placeholder="Tengo ganas de algo con pollo…"
          className="min-h-12 rounded-full border border-border bg-surface px-4 text-[15px] outline-none"
        />

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtros rápidos">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filters[f.key]}
              onClick={() => setFilters((prev) => ({ ...prev, [f.key]: !prev[f.key] }))}
              className={cn(
                "min-h-11 rounded-full border px-3.5 text-[13px] font-semibold",
                filters[f.key]
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-surface",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <PillButton fullWidth disabled={!canSearch} onClick={search}>
          {loading ? <Loader2 className="animate-spin" /> : null} Ver qué puedo cocinar
        </PillButton>
        {error ? (
          <p role="alert" className="text-sm text-danger-soft">
            {error}
          </p>
        ) : null}
      </section>

      {cards ? <SuggestResults groupId={groupId} cards={cards} /> : null}
    </div>
  );
}
