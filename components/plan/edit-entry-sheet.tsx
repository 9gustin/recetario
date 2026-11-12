"use client";

import Link from "next/link";
import { useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { PillButton } from "@/components/shared/pill-button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { dayLabel } from "@/lib/domain/week";
import { slotLabel } from "@/lib/domain/meal-slots";
import type { PlanEntry, PlanMember } from "@/lib/plan/types";
import { cn } from "@/lib/utils";

export type Patch = {
  servings?: number | null;
  dinerIds?: string[];
  leftoversOfEntryId?: string | null;
  cookDate?: string | null;
  freeText?: string | null;
};

type Props = {
  entry: PlanEntry | null;
  members: PlanMember[];
  /** Entradas anteriores de la semana, para marcar "es sobra de…". */
  earlier: PlanEntry[];
  busy: boolean;
  /** Receta nueva propuesta por la IA: enlace para revisarla antes de aceptarla. */
  reviewHref?: string;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, patch: Patch) => void;
  onRemove: (id: string) => void;
};

function Form({
  entry,
  members,
  earlier,
  busy,
  reviewHref,
  onSave,
  onRemove,
}: Omit<Props, "onOpenChange"> & { entry: PlanEntry }) {
  const [servings, setServings] = useState(entry.servings ?? 2);
  const [diners, setDiners] = useState(entry.diner_ids);
  const [leftoverOf, setLeftoverOf] = useState(entry.leftovers_of_entry_id ?? "");
  const [cookDate, setCookDate] = useState(entry.cook_date ?? "");
  const [text, setText] = useState(entry.free_text ?? "");

  const title = entry.recipe?.title ?? entry.free_text ?? "Comida";
  const toggle = (id: string) =>
    setDiners((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

  return (
    <div className="flex max-h-[72dvh] flex-col gap-4 overflow-y-auto px-4 pb-6">
      {reviewHref ? (
        <Link
          href={reviewHref}
          className="flex min-h-12 items-center justify-between rounded-2xl bg-hero px-4 text-sm font-semibold"
        >
          Receta nueva: revisala antes de aprobar <span aria-hidden="true">›</span>
        </Link>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">Porciones</span>
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
          <span className="min-w-[48px] text-center text-sm font-semibold">{servings}</span>
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

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">¿Quiénes comen?</legend>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => {
            const on = diners.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(m.id)}
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
      </fieldset>

      {earlier.length > 0 ? (
        <div className="grid gap-2">
          <label htmlFor="leftover-of" className="text-sm font-medium">
            Es sobra de…
          </label>
          <select
            id="leftover-of"
            value={leftoverOf}
            onChange={(e) => setLeftoverOf(e.target.value)}
            className="min-h-12 rounded-xl border border-border bg-surface px-3 text-base"
          >
            <option value="">No es sobra</option>
            {earlier.map((e) => (
              <option key={e.id} value={e.id}>
                {dayLabel(e.date)} · {slotLabel(e.slot)} · {e.recipe?.title ?? e.free_text}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="grid gap-2">
        <label htmlFor="cook-date" className="text-sm font-medium">
          Se cocina el… (si es otro día)
        </label>
        <Input
          id="cook-date"
          type="date"
          value={cookDate}
          onChange={(e) => setCookDate(e.target.value)}
          className="min-h-12 text-base"
        />
      </div>

      <div className="grid gap-2">
        <label htmlFor="entry-note" className="text-sm font-medium">
          {entry.recipe ? "Nota" : "Texto"}
        </label>
        <Input
          id="entry-note"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-12 text-base"
        />
      </div>

      <PillButton
        fullWidth
        disabled={busy}
        onClick={() =>
          onSave(entry.id, {
            servings,
            dinerIds: diners,
            leftoversOfEntryId: leftoverOf || null,
            cookDate: cookDate || null,
            ...(entry.recipe ? {} : { freeText: text.trim() || entry.free_text }),
          })
        }
      >
        Guardar
      </PillButton>
      <PillButton
        fullWidth
        variant="outline"
        size="md"
        disabled={busy}
        onClick={() => onRemove(entry.id)}
        aria-label={`Quitar ${title} del plan`}
      >
        <Trash2 /> Quitar del plan
      </PillButton>
    </div>
  );
}

/** Editar una comida del plan: porciones, quiénes comen, sobras, día de cocción y nota. */
export function EditEntrySheet({ entry, onOpenChange, ...rest }: Props) {
  return (
    <Sheet open={entry !== null} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88dvh] rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>
            {entry ? (entry.recipe?.title ?? entry.free_text ?? "Comida") : "Comida"}
          </SheetTitle>
          <SheetDescription>
            {entry ? `${slotLabel(entry.slot)} · ${dayLabel(entry.date)}` : ""}
          </SheetDescription>
        </SheetHeader>
        {entry ? <Form key={entry.id} entry={entry} {...rest} /> : null}
      </SheetContent>
    </Sheet>
  );
}
