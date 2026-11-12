"use client";

import { useState } from "react";
import { Check, Clock, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { scaledIngredientLabel, type CookingIngredient } from "@/lib/domain/cooking-display";

type Props = {
  title: string;
  ingredients: CookingIngredient[];
  baseServings: number;
  servings: number;
  onServingsChange: (servings: number) => void;
  minutes: number | null;
};

/** Pantalla 0: porciones escalables, ingredientes con checks y tiempo estimado. */
export function MiseEnPlace({
  title,
  ingredients,
  baseServings,
  servings,
  onServingsChange,
  minutes,
}: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      <div>
        <p className="text-[13px] font-semibold text-muted">Antes de empezar</p>
        <h1 className="mt-1 font-display text-[33px] leading-[1.1] font-normal text-balance">
          {title}
        </h1>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Porciones"
          className="flex items-center gap-1 rounded-full bg-surface p-1"
        >
          <button
            type="button"
            aria-label="Menos porciones"
            onClick={() => onServingsChange(Math.max(1, servings - 1))}
            className="flex size-11 items-center justify-center rounded-full bg-surface-2"
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <span className="min-w-[88px] text-center text-sm font-semibold">
            {servings} {servings === 1 ? "porción" : "porciones"}
          </span>
          <button
            type="button"
            aria-label="Más porciones"
            onClick={() => onServingsChange(servings + 1)}
            className="flex size-11 items-center justify-center rounded-full bg-surface-2"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>
        {minutes ? (
          <span className="flex items-center gap-1.5 text-sm text-muted">
            <Clock className="size-4" aria-hidden="true" /> {minutes} min
          </span>
        ) : null}
      </div>

      <ul className="flex flex-col gap-2 pb-2">
        {ingredients.map((ing) => {
          const done = checked.has(ing.id);
          return (
            <li key={ing.id}>
              <button
                type="button"
                aria-pressed={done}
                onClick={() => toggle(ing.id)}
                className="flex min-h-12 w-full items-center gap-3 rounded-2xl bg-surface px-3.5 text-left"
              >
                <span
                  className={cn(
                    "flex size-6 flex-none items-center justify-center rounded-md border",
                    done ? "border-accent bg-accent text-accent-foreground" : "border-muted",
                  )}
                >
                  {done ? <Check className="size-4" aria-hidden="true" /> : null}
                </span>
                <span className={cn("text-[15px]", done && "text-muted line-through")}>
                  {scaledIngredientLabel(ing, baseServings, servings)}
                  {ing.optional ? <span className="text-muted"> (opcional)</span> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
