"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, Minus, Plus } from "lucide-react";
import { PillButton } from "@/components/shared/pill-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { scaledIngredientLabel } from "@/lib/domain/cooking-display";
import type { PublicRecipe } from "@/lib/schemas/public-recipe";

/** Vista pública de una receta compartida por link: liviana, sin barras de la app. */
export function PublicRecipeView({ token, recipe }: { token: string; recipe: PublicRecipe }) {
  const [servings, setServings] = useState(recipe.servings);
  const sharedBy = recipe.shared_by.name?.trim() || "Alguien";

  return (
    <article className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background pb-32">
      <header className="relative flex min-h-[260px] flex-col justify-end gap-2 overflow-hidden bg-hero p-5 text-foreground">
        {recipe.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={recipe.image_url} alt="" className="absolute inset-0 size-full object-cover" />
        ) : null}
        <div className="relative flex flex-col gap-2 rounded-2xl bg-background/80 p-4 backdrop-blur-sm">
          <h1 className="font-display text-[34px] leading-[1.05] font-normal text-balance">
            {recipe.title}
          </h1>
          <p className="flex items-center gap-2 text-sm text-muted">
            <Avatar data-size="sm">
              {recipe.shared_by.avatar_url ? (
                <AvatarImage src={recipe.shared_by.avatar_url} alt="" />
              ) : null}
              <AvatarFallback>{sharedBy.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            Compartida por {sharedBy}
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-6 px-5 pt-5">
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

        <section>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-[22px] font-normal">Ingredientes</h2>
            <div
              role="group"
              aria-label="Porciones"
              className="flex items-center gap-1 rounded-full bg-surface p-1"
            >
              <button
                type="button"
                aria-label="Menos porciones"
                onClick={() => setServings((s) => Math.max(1, s - 1))}
                className="flex size-11 items-center justify-center rounded-full bg-surface-2"
              >
                <Minus className="size-4" aria-hidden="true" />
              </button>
              <span className="min-w-[84px] text-center text-[13px] font-semibold">
                {servings} {servings === 1 ? "porción" : "porciones"}
              </span>
              <button
                type="button"
                aria-label="Más porciones"
                onClick={() => setServings((s) => s + 1)}
                className="flex size-11 items-center justify-center rounded-full bg-surface-2"
              >
                <Plus className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
          <ul className="mt-2 flex flex-col">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="border-b border-border py-2.5 text-[15px]">
                {scaledIngredientLabel(ing, recipe.servings, servings)}
                {ing.optional ? <span className="text-muted"> (opcional)</span> : null}
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-[22px] font-normal">Pasos</h2>
          {recipe.steps.map((step, i) => (
            <div key={i} className="flex gap-3 rounded-2xl bg-surface p-3">
              <span className="flex size-7 flex-none items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[15px]">{step.instruction}</p>
                {step.duration_seconds ? (
                  <p className="mt-1 text-[13px] text-muted">
                    {Math.round(step.duration_seconds / 60)} min
                  </p>
                ) : null}
                {step.tip ? <p className="mt-1 text-[13px] text-muted">Tip: {step.tip}</p> : null}
              </div>
            </div>
          ))}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md flex-col gap-2 border-t border-border bg-background px-5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <PillButton asChild fullWidth>
          <Link href={`/r/${token}/cocinar`}>Cocinar</Link>
        </PillButton>
        <PillButton asChild fullWidth variant="outline" size="md">
          <Link href={`/r/${token}/guardar`}>Guardala en tu recetario</Link>
        </PillButton>
      </div>
    </article>
  );
}
