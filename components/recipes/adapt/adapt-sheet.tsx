"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { PillButton } from "@/components/shared/pill-button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { diffSnapshots, parseSnapshot } from "@/lib/domain/recipe-diff";
import { saveAdaptedVariant } from "@/lib/recipes/adapt-actions";
import type { RecipeDraft } from "@/lib/schemas/recipe";
import { cn } from "@/lib/utils";
import { CompatBadges, type CompatMember } from "../compat-badges";
import { DiffView } from "../history/diff-view";

type OriginalRecipe = {
  id: string;
  title: string;
  servings: number;
  ingredients: {
    raw_text: string | null;
    quantity: number | null;
    unit: string | null;
    position?: number;
  }[];
  steps: { instruction: string; duration_seconds: number | null; position?: number }[];
};

type Props = {
  recipe: OriginalRecipe;
  /** Personas del grupo que tienen restricciones cargadas. */
  members: { id: string; name: string }[];
};

type Result = {
  draft: RecipeDraft;
  changes: string[];
  titleSuffix: string;
  compat: CompatMember[];
};

/** "Adaptar para…": elegir personas, ver qué cambió contra la original y guardar la variante. */
export function AdaptSheet({ recipe, members }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [title, setTitle] = useState("");
  const [saving, startSaving] = useTransition();

  if (members.length === 0) return null;

  async function adapt() {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai/recipes/${recipe.id}/adapt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberIds: selected }),
      });
      const body = (await res.json().catch(() => ({}))) as Partial<Result> & { error?: string };
      if (!res.ok || !body.draft) {
        setError(body.error ?? "No pudimos adaptar la receta. Probá de nuevo.");
        return;
      }
      setResult(body as Result);
      setTitle(`${recipe.title} (${body.titleSuffix || "adaptada"})`.slice(0, 120));
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión y probá de nuevo.");
    } finally {
      setWorking(false);
    }
  }

  function save() {
    if (!result) return;
    startSaving(async () => {
      const res = await saveAdaptedVariant({ recipeId: recipe.id, title, draft: result.draft });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Guardaste la variante");
      setOpen(false);
      router.push(`/g/${res.data.groupId}/recetas/${res.data.id}`);
    });
  }

  const diff = result
    ? diffSnapshots(
        parseSnapshot({
          title: recipe.title,
          servings: recipe.servings,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
        }),
        parseSnapshot({
          title: result.draft.title,
          servings: result.draft.servings,
          ingredients: result.draft.ingredients,
          steps: result.draft.steps,
        }),
      )
    : null;

  function close(next: boolean) {
    setOpen(next);
    if (!next) {
      setResult(null);
      setError(null);
    }
  }

  return (
    <>
      <PillButton variant="outline" fullWidth size="md" onClick={() => setOpen(true)}>
        <Wand2 className="size-4" /> Adaptar para…
      </PillButton>

      <Sheet open={open} onOpenChange={close}>
        <SheetContent side="bottom" className="max-h-[88dvh] rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Adaptar receta</SheetTitle>
            <SheetDescription>Armamos una variante que no pisa la original.</SheetDescription>
          </SheetHeader>

          <div className="flex max-h-[70dvh] flex-col gap-4 overflow-y-auto px-4 pb-6">
            {working ? (
              <div
                className="flex flex-col items-center gap-3 py-10 text-center"
                role="status"
                aria-live="polite"
              >
                <Loader2 className="size-10 animate-spin text-accent" aria-hidden="true" />
                <p className="font-display text-[22px]">Adaptando la receta…</p>
              </div>
            ) : result && diff ? (
              <>
                <section className="flex flex-col gap-2">
                  <h3 className="text-xs font-bold tracking-[0.1em] text-muted">QUÉ CAMBIÓ</h3>
                  <ul className="flex flex-col gap-1 text-sm">
                    {result.changes.map((c, i) => (
                      <li key={i}>• {c}</li>
                    ))}
                  </ul>
                </section>
                <CompatBadges compat={result.compat} />
                <section className="rounded-2xl bg-surface p-3">
                  <h3 className="mb-2 text-xs font-bold tracking-[0.1em] text-muted">
                    ORIGINAL ↔ ADAPTADA
                  </h3>
                  <DiffView diff={diff} initial={false} />
                </section>
                <div className="grid gap-2">
                  <label htmlFor="variant-title" className="text-sm font-medium">
                    Nombre de la variante
                  </label>
                  <Input
                    id="variant-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="min-h-12 text-base"
                  />
                </div>
                <PillButton fullWidth disabled={saving || !title.trim()} onClick={save}>
                  {saving ? "Guardando…" : "Guardar como variante"}
                </PillButton>
                <PillButton fullWidth variant="outline" size="md" onClick={() => setResult(null)}>
                  Elegir otras personas
                </PillButton>
              </>
            ) : (
              <>
                <p className="text-sm text-muted">¿Para quién la adaptamos?</p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Personas">
                  {members.map((m) => {
                    const on = selected.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setSelected((prev) =>
                            on ? prev.filter((x) => x !== m.id) : [...prev, m.id],
                          )
                        }
                        className={cn(
                          "min-h-11 rounded-full border px-4 text-sm font-semibold",
                          on
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-surface",
                        )}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
                {error ? (
                  <p role="alert" className="text-sm text-danger-soft">
                    {error}
                  </p>
                ) : null}
                <PillButton fullWidth disabled={selected.length === 0} onClick={() => void adapt()}>
                  Adaptar
                </PillButton>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
