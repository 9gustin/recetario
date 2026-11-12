"use client";

import type { CookingSummary } from "@/lib/cooking/queries";
import type { RecipeQuestion } from "@/lib/ai/assistant/queries";
import { CookingHistory } from "./cooking-history";
import { AdaptSheet } from "../adapt/adapt-sheet";
import { ForWhom, type ForWhomMember } from "./for-whom";
import { ShareSheet, type ShareContactItem, type ShareGroup } from "../share-sheet";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Heart, History, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { PillButton } from "@/components/shared/pill-button";
import { cn } from "@/lib/utils";
import { formatQuantity } from "@/lib/domain/format";
import { scaleQuantity } from "@/lib/domain/scale";
import { parseIngredientLine } from "@/lib/domain/ingredient-line";
import { deleteRecipe, toggleFavorite } from "@/lib/recipes/actions";

type Props = {
  groupId: string;
  cooking?: CookingSummary;
  questions?: RecipeQuestion[];
  forWhom?: ForWhomMember[];
  adaptMembers?: { id: string; name: string }[];
  /** Fila de ingrediente → el peor estado entre las personas del grupo. */
  ingredientProblems?: Record<string, "forbidden" | "limit" | "unknown">;
  share?: {
    groups: ShareGroup[];
    contacts: ShareContactItem[];
    initialShareUrl: string | null;
  };
  recipe: {
    id: string;
    title: string;
    description: string | null;
    image_url: string | null;
    servings: number;
    prep_minutes: number | null;
    cook_minutes: number | null;
    total_minutes: number | null;
    difficulty: string | null;
    tags: string[];
    forked_from?: { title: string; group_name: string | null; href: string | null } | null;
    current_version: number;
    is_favorite: boolean;
    ingredients: {
      id: string;
      raw_text: string | null;
      quantity: number | null;
      unit: string | null;
      preparation: string | null;
      optional: boolean;
    }[];
    steps: {
      id: string;
      position: number;
      instruction: string;
      duration_seconds: number | null;
      timer_kind: string | null;
      tip: string | null;
    }[];
  };
};

export function RecipeDetail({
  groupId,
  recipe,
  cooking,
  questions = [],
  forWhom = [],
  adaptMembers = [],
  ingredientProblems = {},
  share,
}: Props) {
  const router = useRouter();
  const [servings, setServings] = useState(recipe.servings);
  const [favorite, setFavorite] = useState(recipe.is_favorite);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const total = recipe.total_minutes ?? (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0);

  function toggleIngredient(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onFavorite() {
    setFavorite((f) => !f);
    startTransition(async () => {
      await toggleFavorite({ recipeId: recipe.id });
    });
  }

  function onDelete() {
    startTransition(async () => {
      const res = await deleteRecipe({ id: recipe.id });
      if (res.ok) router.push(`/g/${groupId}/recetas`);
    });
  }

  return (
    <main className="flex flex-col">
      {/* Header con foto */}
      <section className="relative flex min-h-[240px] flex-col justify-between overflow-hidden bg-hero p-4 text-foreground">
        {recipe.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={recipe.image_url} alt="" className="absolute inset-0 size-full object-cover" />
        ) : null}
        <div className="relative flex items-center justify-between">
          <Link
            href={`/g/${groupId}/recetas`}
            aria-label="Volver"
            className="flex size-11 items-center justify-center rounded-full bg-black/30 text-foreground"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <button
            type="button"
            onClick={onFavorite}
            aria-label="Guardar en favoritas"
            className={cn(
              "flex size-11 items-center justify-center rounded-full bg-black/30",
              favorite ? "text-accent" : "text-foreground",
            )}
          >
            <Heart className={cn("size-5", favorite && "fill-current")} />
          </button>
        </div>
        <div className="relative">
          <h1 className="max-w-[300px] font-display text-[34px] leading-[1.04] font-normal">
            {recipe.title}
          </h1>
          <p className="mt-2 text-[13px] text-foreground/80">
            {total > 0 ? `${total} min` : "—"} · {recipe.steps.length} pasos · v
            {recipe.current_version}
          </p>
        </div>
      </section>

      <div className="flex flex-col gap-5 px-5 pt-4 pb-8">
        {recipe.forked_from ? (
          <p className="text-[13px] text-muted">
            Basada en{" "}
            {recipe.forked_from.href ? (
              <Link href={recipe.forked_from.href} className="font-semibold text-accent underline">
                {recipe.forked_from.title}
              </Link>
            ) : (
              <strong className="font-semibold text-foreground">{recipe.forked_from.title}</strong>
            )}
            {recipe.forked_from.group_name ? ` de ${recipe.forked_from.group_name}` : ""}
          </p>
        ) : null}

        {recipe.tags.length > 0 || recipe.difficulty ? (
          <div className="flex flex-wrap gap-2">
            {recipe.difficulty ? (
              <span className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold">
                {recipe.difficulty === "facil"
                  ? "Fácil"
                  : recipe.difficulty === "media"
                    ? "Media"
                    : "Difícil"}
              </span>
            ) : null}
            {recipe.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {recipe.description ? <p className="text-sm text-muted">{recipe.description}</p> : null}
        {forWhom.length > 0 ? <ForWhom members={forWhom} /> : null}
        {cooking ? <CookingHistory summary={cooking} /> : null}

        {/* Porciones + ingredientes */}
        <div>
          <div className="flex items-center justify-between">
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
                className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-lg"
              >
                −
              </button>
              <span className="min-w-[70px] text-center text-[13px] font-semibold">
                {servings} {servings === 1 ? "porción" : "porciones"}
              </span>
              <button
                type="button"
                aria-label="Más porciones"
                onClick={() => setServings((s) => s + 1)}
                className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-lg"
              >
                +
              </button>
            </div>
          </div>
          <ul className="mt-1 flex flex-col">
            {recipe.ingredients.map((ing) => {
              const parsed = parseIngredientLine(ing.raw_text ?? "");
              const name = parsed.name || ing.raw_text || "";
              const scaled =
                ing.quantity !== null
                  ? formatQuantity(scaleQuantity(ing.quantity, recipe.servings, servings), ing.unit)
                  : null;
              return (
                <li
                  key={ing.id}
                  className="flex items-center justify-between gap-3 border-b border-border py-2.5 text-[15px]"
                >
                  <button
                    type="button"
                    onClick={() => toggleIngredient(ing.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span
                      className={cn(
                        "flex size-5 flex-none items-center justify-center rounded-md border",
                        checked.has(ing.id)
                          ? "border-accent bg-accent text-accent-foreground"
                          : "border-border",
                      )}
                    >
                      {checked.has(ing.id) ? "✓" : ""}
                    </span>
                    <span
                      className={cn(
                        "truncate",
                        checked.has(ing.id) && "text-muted line-through",
                        ingredientProblems[ing.id] === "forbidden" &&
                          "font-semibold text-danger-soft",
                        ingredientProblems[ing.id] === "limit" && "font-semibold text-accent",
                      )}
                    >
                      {name}
                      {ing.preparation ? (
                        <span className="text-muted">, {ing.preparation}</span>
                      ) : null}
                      {ing.optional ? <span className="text-muted"> (opcional)</span> : null}
                    </span>
                  </button>
                  {scaled ? <span className="flex-none text-muted">{scaled}</span> : null}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Pasos */}
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-[22px] font-normal">Pasos</h2>
          {recipe.steps.map((step) => (
            <div key={step.id} className="flex gap-3 rounded-2xl bg-surface p-3">
              <span className="flex size-7 flex-none items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                {step.position + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[15px]">{step.instruction}</p>
                {step.duration_seconds ? (
                  <p className="mt-1 text-[13px] text-muted">
                    {Math.round(step.duration_seconds / 60)} min
                    {step.timer_kind === "passive" ? " · esperar" : ""}
                  </p>
                ) : null}
                {step.tip ? <p className="mt-1 text-[13px] text-muted">Tip: {step.tip}</p> : null}
              </div>
            </div>
          ))}
        </div>

        {questions.length > 0 ? (
          <section className="flex flex-col gap-2" aria-label="Preguntas sobre esta receta">
            <h2 className="font-display text-[22px] font-normal">Preguntas sobre esta receta</h2>
            <ul className="flex flex-col gap-2">
              {questions.map((q) => (
                <li key={q.conversationId}>
                  <Link
                    href={`/g/${groupId}/preguntar?c=${q.conversationId}`}
                    className="flex min-h-12 items-center rounded-2xl border border-border bg-surface px-4 text-sm"
                  >
                    <span className="truncate">{q.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Acciones */}
        <div className="flex flex-col gap-2">
          <PillButton asChild fullWidth>
            <Link href={`/g/${groupId}/recetas/${recipe.id}/cocinar`}>Cocinar</Link>
          </PillButton>
          {share ? (
            <ShareSheet
              recipeId={recipe.id}
              recipeTitle={recipe.title}
              currentGroupId={groupId}
              groups={share.groups}
              contacts={share.contacts}
              initialShareUrl={share.initialShareUrl}
            />
          ) : null}
          {adaptMembers.length > 0 ? <AdaptSheet recipe={recipe} members={adaptMembers} /> : null}
          <PillButton asChild variant="outline" fullWidth size="md">
            <Link href={`/g/${groupId}/preguntar?receta=${recipe.id}`}>
              <MessageSquare className="size-4" /> Preguntar por esta receta
            </Link>
          </PillButton>
          <div className="grid grid-cols-3 gap-2">
            <PillButton asChild variant="outline" size="md">
              <Link href={`/g/${groupId}/recetas/${recipe.id}/editar`}>
                <Pencil className="size-4" /> Editar
              </Link>
            </PillButton>
            <PillButton asChild variant="outline" size="md">
              <Link href={`/g/${groupId}/recetas/${recipe.id}/historial`}>
                <History className="size-4" /> Historial
              </Link>
            </PillButton>
            {confirmDelete ? (
              <PillButton
                type="button"
                variant="soft"
                size="md"
                onClick={onDelete}
                disabled={isPending}
              >
                ¿Borrar?
              </PillButton>
            ) : (
              <PillButton
                type="button"
                variant="outline"
                size="md"
                onClick={() => setConfirmDelete(true)}
                className="text-danger-soft"
              >
                <Trash2 className="size-4" /> Borrar
              </PillButton>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
