"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { searchIngredientSuggestions, type IngredientSuggestion } from "@/lib/recipes/actions";

export type RecipeFilterState = {
  favoriteOnly: boolean;
  max30: boolean;
  tag: string | null;
  ingredient: IngredientSuggestion | null;
  /** "Apta para…": ids de las personas elegidas. */
  aptFor: string[];
};

export const EMPTY_FILTERS: RecipeFilterState = {
  favoriteOnly: false,
  max30: false,
  tag: null,
  ingredient: null,
  aptFor: [],
};

export function hasActiveFilters(f: RecipeFilterState) {
  return (
    f.favoriteOnly || f.max30 || f.tag !== null || f.ingredient !== null || f.aptFor.length > 0
  );
}

function chipClass(active: boolean) {
  return cn(
    "flex min-h-9 flex-none items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold whitespace-nowrap",
    active ? "border-foreground bg-foreground text-background" : "border-border bg-surface",
  );
}

type Props = {
  value: RecipeFilterState;
  onChange: (next: RecipeFilterState) => void;
  topTags: string[];
  /** Personas del grupo con perfil alimentario (para el filtro "Apta para…"). */
  members?: { id: string; name: string }[];
};

/** Chips de filtro: Favoritas, ≤ 30 min, etiquetas más usadas y "Tiene ingrediente…". */
export function RecipeFilters({ value, onChange, topTags, members = [] }: Props) {
  const [aptOpen, setAptOpen] = useState(false);
  const [pickingIngredient, setPickingIngredient] = useState(false);
  const [ingredientQuery, setIngredientQuery] = useState("");
  const [suggestions, setSuggestions] = useState<IngredientSuggestion[]>([]);

  useEffect(() => {
    if (ingredientQuery.trim().length < 2) return;
    let cancelled = false;
    const t = setTimeout(() => {
      searchIngredientSuggestions({ q: ingredientQuery }).then((res) => {
        if (!cancelled && res.ok) setSuggestions(res.data);
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [ingredientQuery]);

  const visibleSuggestions = ingredientQuery.trim().length < 2 ? [] : suggestions;

  return (
    <div className="flex flex-col gap-2">
      <div className="-mx-5 flex [scrollbar-width:none] gap-2 overflow-x-auto px-5 pb-1">
        <button
          type="button"
          aria-pressed={value.favoriteOnly}
          onClick={() => onChange({ ...value, favoriteOnly: !value.favoriteOnly })}
          className={chipClass(value.favoriteOnly)}
        >
          Favoritas
        </button>
        <button
          type="button"
          aria-pressed={value.max30}
          onClick={() => onChange({ ...value, max30: !value.max30 })}
          className={chipClass(value.max30)}
        >
          Menos de 30 min
        </button>
        {topTags.map((tag) => (
          <button
            key={tag}
            type="button"
            aria-pressed={value.tag === tag}
            onClick={() => onChange({ ...value, tag: value.tag === tag ? null : tag })}
            className={chipClass(value.tag === tag)}
          >
            {tag}
          </button>
        ))}
        {members.length > 0 ? (
          <button
            type="button"
            aria-expanded={aptOpen}
            aria-pressed={value.aptFor.length > 0}
            onClick={() => setAptOpen((v) => !v)}
            className={chipClass(value.aptFor.length > 0)}
          >
            Apta para…
          </button>
        ) : null}
        {value.ingredient ? (
          <button
            type="button"
            aria-label={`Quitar filtro ${value.ingredient.name}`}
            onClick={() => onChange({ ...value, ingredient: null })}
            className={chipClass(true)}
          >
            Con {value.ingredient.name}
            <X className="size-3.5" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            aria-expanded={pickingIngredient}
            onClick={() => setPickingIngredient((v) => !v)}
            className={chipClass(pickingIngredient)}
          >
            Tiene ingrediente…
          </button>
        )}
      </div>

      {aptOpen && members.length > 0 ? (
        <div
          className="flex flex-wrap gap-2 rounded-2xl border border-border bg-surface p-2"
          role="group"
          aria-label="Apta para"
        >
          {members.map((m) => {
            const on = value.aptFor.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  onChange({
                    ...value,
                    aptFor: on ? value.aptFor.filter((x) => x !== m.id) : [...value.aptFor, m.id],
                  })
                }
                className={chipClass(on)}
              >
                {m.name}
              </button>
            );
          })}
        </div>
      ) : null}

      {pickingIngredient && !value.ingredient ? (
        <div className="flex flex-col gap-1 rounded-2xl border border-border bg-surface p-2">
          <input
            autoFocus
            value={ingredientQuery}
            onChange={(e) => setIngredientQuery(e.target.value)}
            placeholder="Ej.: pollo, zapallito…"
            aria-label="Buscar ingrediente"
            className="min-h-11 rounded-xl bg-background px-3 text-[15px] outline-none placeholder:text-muted"
          />
          {visibleSuggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onChange({ ...value, ingredient: s });
                setPickingIngredient(false);
                setIngredientQuery("");
              }}
              className="min-h-11 rounded-xl px-3 text-left text-[15px] font-medium hover:bg-surface-2"
            >
              {s.name}
            </button>
          ))}
          {ingredientQuery.trim().length >= 2 && visibleSuggestions.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted">No encontramos ese ingrediente.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
