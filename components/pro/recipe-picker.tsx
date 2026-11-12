"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { searchRecipesForPlan } from "@/lib/pro/actions";
import type { PublicCard } from "@/lib/public/queries";

/** Buscador de recetas públicas (sin IA) para armar planes o enviar grupos de recetas. */
export function RecipePicker({ onPick }: { onPick: (r: { id: string; title: string }) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PublicCard[]>([]);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(
      () => {
        void searchRecipesForPlan({ q: q || undefined }).then((res) => {
          if (!cancelled) setResults(res.ok ? res.data.slice(0, 8) : []);
        });
      },
      q ? 250 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="flex flex-col gap-2">
      <label className="flex min-h-12 items-center gap-2.5 rounded-full border border-border bg-surface px-3.5">
        <Search className="size-5 flex-none text-muted" aria-hidden="true" />
        <span className="sr-only">Buscar receta</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar en el catálogo…"
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
        />
      </label>
      <ul className="flex flex-col gap-1.5">
        {results.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onPick({ id: r.id, title: r.title })}
              className="flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl border border-border bg-surface px-4 text-left"
            >
              <span className="truncate text-[15px] font-semibold">{r.title}</span>
              <span className="flex-none text-xs text-muted">
                {r.total_minutes ? `${r.total_minutes} min` : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
