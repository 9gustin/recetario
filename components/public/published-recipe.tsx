"use client";

import { useState } from "react";
import { Clock, Minus, Plus } from "lucide-react";
import { scaledIngredientLabel } from "@/lib/domain/cooking-display";
import type { PublishedRecipe } from "@/lib/public/queries";

/** Ficha pública: ingredientes con porciones ajustables y pasos. */
export function PublishedRecipeBody({ recipe }: { recipe: PublishedRecipe }) {
  const [servings, setServings] = useState(recipe.servings);
  const info = recipe.storage_info;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
        {recipe.total_minutes ? (
          <span className="flex items-center gap-1.5">
            <Clock className="size-4" aria-hidden="true" /> {recipe.total_minutes} min
          </span>
        ) : null}
        {recipe.tags.map((t) => (
          <span key={t} className="rounded-full border border-border px-2.5 py-0.5 text-xs">
            {t}
          </span>
        ))}
      </div>
      {recipe.description ? <p className="text-[15px] text-muted">{recipe.description}</p> : null}

      <section aria-labelledby="ingredientes">
        <div className="flex items-center justify-between gap-3">
          <h2 id="ingredientes" className="font-display text-[22px] font-normal">
            Ingredientes
          </h2>
          <div role="group" aria-label="Porciones" className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Menos porciones"
              onClick={() => setServings((s) => Math.max(1, s - 1))}
              className="flex size-11 items-center justify-center rounded-full border border-border"
            >
              <Minus className="size-4" />
            </button>
            <span className="min-w-20 text-center text-sm font-semibold" aria-live="polite">
              {servings} {servings === 1 ? "porción" : "porciones"}
            </span>
            <button
              type="button"
              aria-label="Más porciones"
              onClick={() => setServings((s) => s + 1)}
              className="flex size-11 items-center justify-center rounded-full border border-border"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>
        <ul className="mt-3 flex flex-col gap-1.5">
          {recipe.ingredients.map((i) => (
            <li key={i.position} className="rounded-xl bg-surface px-3.5 py-2.5 text-[15px]">
              {scaledIngredientLabel(
                {
                  ingredient_id: null,
                  raw_text: i.raw_text,
                  quantity: i.quantity,
                  unit: i.unit,
                  preparation: i.preparation,
                  optional: i.optional,
                } as never,
                recipe.servings,
                servings,
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="pasos">
        <h2 id="pasos" className="font-display text-[22px] font-normal">
          Pasos
        </h2>
        <ol className="mt-3 flex flex-col gap-3">
          {recipe.steps.map((s, n) => (
            <li key={s.position} className="flex gap-3 text-[15px] leading-relaxed">
              <span className="flex size-7 flex-none items-center justify-center rounded-full bg-hero text-sm font-bold">
                {n + 1}
              </span>
              <span>
                {s.instruction}
                {s.duration_seconds ? (
                  <span className="text-muted"> ({Math.round(s.duration_seconds / 60)} min)</span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {info?.fridge_days !== undefined ? (
        <section className="rounded-2xl bg-surface p-4 text-sm" aria-label="Conservación">
          <p className="font-semibold">Conservación</p>
          <p>En la heladera: hasta {info.fridge_days} días.</p>
          {info.freezer_days ? <p>En el freezer: hasta {info.freezer_days} días.</p> : null}
          {info.reheat ? <p className="text-muted">Para recalentar: {info.reheat}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
