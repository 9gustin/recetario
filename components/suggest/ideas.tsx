"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { PillButton } from "@/components/shared/pill-button";
import type { SuggestCard } from "@/lib/schemas/suggest";
import { cn } from "@/lib/utils";
import { SuggestResults } from "./results";

type Tab = "bought" | "library" | "new";

const TABS: { key: Tab; label: string }[] = [
  { key: "bought", label: "Con lo que compraste" },
  { key: "library", label: "Recetario" },
  { key: "new", label: "Nuevas" },
];

/** "Ideas para hoy": 3 ideas con su motivo; "Otras 3 ideas" no repite las ya mostradas. */
export function Ideas({ groupId }: { groupId: string }) {
  const [tab, setTab] = useState<Tab>("library");
  const [cards, setCards] = useState<SuggestCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = useRef<Record<string, string[]>>({});
  const started = useRef<Set<Tab>>(new Set());

  const load = useCallback(
    async (which: Exclude<Tab, "bought">, more: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/ai/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupId,
            mode: "ideas",
            tab: which,
            exclude: more ? (shown.current[which] ?? []) : [],
          }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          cards?: SuggestCard[];
          error?: string;
        };
        if (!res.ok) throw new Error(body.error ?? "No pudimos buscar ideas.");
        const next = body.cards ?? [];
        shown.current[which] = [
          ...(more ? (shown.current[which] ?? []) : []),
          ...next.map((c) => c.recipeId),
        ];
        setCards(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No pudimos buscar ideas.");
        setCards([]);
      } finally {
        setLoading(false);
      }
    },
    [groupId],
  );

  // Carga la pestaña la primera vez que se abre.
  useEffect(() => {
    if (tab === "bought" || started.current.has(tab)) return;
    started.current.add(tab);
    void load(tab, false);
  }, [tab, load]);

  function pickTab(next: Tab) {
    setTab(next);
    setCards([]);
    setError(null);
    if (next !== "bought" && started.current.has(next)) void load(next, false);
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="px-5">
        <h2 className="font-display text-[30px] leading-[1.05] font-normal">Ideas para hoy</h2>
      </header>
      <div
        role="tablist"
        aria-label="Origen de las ideas"
        className="flex gap-2 overflow-x-auto px-5"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => pickTab(t.key)}
            className={cn(
              "min-h-11 flex-none rounded-full border px-4 text-[13px] font-semibold",
              tab === t.key
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-surface",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "bought" ? (
        <p className="px-5 py-6 text-center text-sm text-muted">
          Cuando armes tu lista de compras, acá vas a ver ideas para aprovechar lo que compraste.
        </p>
      ) : (
        <>
          {loading ? (
            <p
              role="status"
              className="flex items-center justify-center gap-2 px-5 py-6 text-sm text-muted"
            >
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Buscando ideas…
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="px-5 text-sm text-danger-soft">
              {error}
            </p>
          ) : null}
          {!loading && !error ? <SuggestResults groupId={groupId} cards={cards} /> : null}
          {!loading ? (
            <div className="px-5 pb-8">
              <PillButton fullWidth variant="soft" onClick={() => void load(tab, true)}>
                Otras 3 ideas
              </PillButton>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
