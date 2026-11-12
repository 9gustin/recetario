"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { savePublishedRecipe } from "@/lib/public/actions";
import { searchCatalogCards, type CatalogCard } from "@/lib/public/catalog-actions";
import { Heart, Search } from "lucide-react";
import { PillButton } from "@/components/shared/pill-button";
import { CompatBadges } from "@/components/recipes/compat-badges";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { dayLabel } from "@/lib/domain/week";
import { slotLabel, type MealSlot } from "@/lib/domain/meal-slots";
import { searchRecipes, type RecipeSearchResult } from "@/lib/recipes/actions";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  date: string;
  slot: MealSlot;
  slots: MealSlot[];
  /** Sin momentos: se agrega una comida suelta (listado "Mis comidas"). */
  looseMeal?: boolean;
  busy: boolean;
  onPick: (choice: { recipeId?: string; freeText?: string; slot: MealSlot }) => void;
};

/** Elegir una receta del grupo (con compatibilidad) o escribir algo ("Comemos afuera") para un momento. */
export function AddEntrySheet({
  open,
  onOpenChange,
  groupId,
  date,
  slot: defaultSlot,
  slots,
  looseMeal,
  busy,
  onPick: onPickRaw,
}: Props) {
  const [chosenSlot, setChosenSlot] = useState<MealSlot | null>(null);
  const slot = chosenSlot ?? defaultSlot;
  const onPick = (choice: { recipeId?: string; freeText?: string }) =>
    onPickRaw({ ...choice, slot });
  const [q, setQ] = useState("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [results, setResults] = useState<RecipeSearchResult["recipes"]>([]);
  const [loading, setLoading] = useState(false);
  const [freeText, setFreeText] = useState("");
  const [catalog, setCatalog] = useState<CatalogCard[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(
      () => {
        setLoading(true);
        searchRecipes({
          groupId,
          q: q || undefined,
          favoriteOnly: favoriteOnly || undefined,
          limit: 12,
        }).then((res) => {
          if (cancelled) return;
          setResults(res.ok ? res.data.recipes : []);
          setLoading(false);
        });
      },
      q ? 220 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, q, favoriteOnly, groupId]);

  // Después de tus recetas: ideas del catálogo (aptas para el grupo).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(() => {
      void searchCatalogCards({ groupId, q: q || undefined }).then((res) => {
        if (!cancelled) setCatalog(res.ok ? res.data.slice(0, 4) : []);
      });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, q, groupId]);

  async function pickCatalog(recipeId: string) {
    setSaving(true);
    const res = await savePublishedRecipe({ recipeId, groupId });
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    onPick({ recipeId: res.data.recipeId });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) setChosenSlot(null);
        onOpenChange(o);
      }}
    >
      <SheetContent side="bottom" className="max-h-[88dvh] rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>
            {looseMeal ? "Agregar comida" : `Agregar comida · ${dayLabel(date)}`}
          </SheetTitle>
          <SheetDescription>
            {looseMeal
              ? "Elegí una receta o escribí algo."
              : "Elegí el momento y una receta, o escribí algo."}
          </SheetDescription>
          {!looseMeal ? (
            <div
              role="radiogroup"
              aria-label="Momento del día"
              className="flex flex-wrap gap-2 pt-1"
            >
              {slots.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={s === slot}
                  onClick={() => setChosenSlot(s)}
                  className={cn(
                    "min-h-11 rounded-full border px-4 text-[13px] font-semibold",
                    s === slot
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-surface",
                  )}
                >
                  {slotLabel(s)}
                </button>
              ))}
            </div>
          ) : null}
        </SheetHeader>

        <div className="flex max-h-[72dvh] flex-col gap-3 overflow-y-auto px-4 pb-6">
          <label className="flex min-h-12 items-center gap-2.5 rounded-full border border-border bg-surface px-3.5">
            <Search className="size-5 flex-none text-muted" aria-hidden="true" />
            <span className="sr-only">Buscar receta</span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscá una receta"
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              aria-pressed={favoriteOnly}
              onClick={() => setFavoriteOnly((v) => !v)}
              className={cn(
                "flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold",
                favoriteOnly
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-surface",
              )}
            >
              <Heart className="size-3.5" aria-hidden="true" /> Favoritas
            </button>
          </div>

          <ul className="flex flex-col gap-2" aria-busy={loading}>
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onPick({ recipeId: r.id })}
                  className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-surface px-3 py-2 text-left disabled:opacity-60"
                >
                  <span
                    className="flex size-10 flex-none items-center justify-center overflow-hidden rounded-[10px] bg-hero"
                    aria-hidden="true"
                  >
                    {r.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.image_url}
                        alt=""
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      "🍽️"
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{r.title}</span>
                    <span className="flex items-center gap-2 text-xs text-muted">
                      {r.total_minutes ? `${r.total_minutes} min` : "Sin tiempo"}
                      <CompatBadges compat={r.compat} />
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {!loading && results.length === 0 ? (
              <li className="py-3 text-center text-sm text-muted">No encontramos recetas.</li>
            ) : null}
          </ul>

          {catalog.length > 0 ? (
            <section
              className="flex flex-col gap-2 border-t border-border pt-3"
              aria-label="Del catálogo"
            >
              <p className="text-sm font-medium">Del catálogo</p>
              <ul className="flex flex-col gap-2">
                {catalog.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={busy || saving}
                      onClick={() => void pickCatalog(c.id)}
                      className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-surface px-3 py-2 text-left disabled:opacity-60"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{c.title}</span>
                        <span className="text-xs text-muted">
                          {c.total_minutes ? `${c.total_minutes} min · ` : ""}se guarda en tu
                          recetario
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <label htmlFor="free-text" className="text-sm font-medium">
              O escribí algo
            </label>
            <Input
              id="free-text"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="Comemos afuera, pedimos, sobras…"
              className="min-h-12 text-base"
            />
            <PillButton
              disabled={busy || !freeText.trim()}
              onClick={() => onPick({ freeText: freeText.trim() })}
            >
              Agregar
            </PillButton>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
