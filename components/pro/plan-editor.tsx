"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { PillButton } from "@/components/shared/pill-button";
import { RecipePicker } from "@/components/pro/recipe-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deletePlan, savePlan } from "@/lib/pro/actions";
import type { ProPlanItem, ProPlanRow } from "@/lib/pro/queries";

type Item = { key: string; recipeId: string | null; title: string; quantity: number; note: string };

const GOALS = [
  "Bajar de peso",
  "Masa muscular",
  "Más verduras",
  "Control de glucosa",
  "Sin gluten",
];

export function PlanEditor({ plan, items }: { plan: ProPlanRow | null; items: ProPlanItem[] }) {
  const router = useRouter();
  const [title, setTitle] = useState(plan?.title ?? "");
  const [goal, setGoal] = useState(plan?.goal ?? "");
  const [tags, setTags] = useState<string[]>(plan?.goal_tags ?? []);
  const [notes, setNotes] = useState(plan?.notes ?? "");
  const [isTemplate, setIsTemplate] = useState(plan?.is_template ?? false);
  const [list, setList] = useState<Item[]>(
    items.map((i) => ({
      key: i.id,
      recipeId: i.recipe_id,
      title: i.title,
      quantity: i.quantity,
      note: i.note ?? "",
    })),
  );
  const [freeText, setFreeText] = useState("");
  const [pending, start] = useTransition();

  const add = (i: Omit<Item, "key" | "quantity" | "note">) =>
    setList((prev) => [...prev, { ...i, key: crypto.randomUUID(), quantity: 1, note: "" }]);

  function save() {
    start(async () => {
      const res = await savePlan({
        id: plan?.id,
        title,
        goal,
        goalTags: tags,
        notes,
        isTemplate,
        items: list.map((i) => ({
          recipeId: i.recipeId,
          title: i.recipeId ? i.title : null,
          freeText: i.recipeId ? null : i.title,
          quantity: i.quantity,
          note: i.note || null,
        })),
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Plan guardado.");
      router.replace(`/pro/planes/${res.data.id}`);
      router.refresh();
    });
  }

  function remove() {
    if (!plan || !window.confirm("¿Borrar este plan?")) return;
    start(async () => {
      const res = await deletePlan({ id: plan.id });
      if (!res.ok) return void toast.error(res.error);
      router.push("/pro");
    });
  }

  return (
    <div className="flex flex-col gap-5 px-5 pb-10">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="plan-title">Título del plan</Label>
        <Input id="plan-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="plan-goal">Objetivo</Label>
        <Input
          id="plan-goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Ej.: sumar verduras en las cenas"
        />
        <div className="flex flex-wrap gap-2 pt-1" role="group" aria-label="Objetivos frecuentes">
          {GOALS.map((g) => {
            const on = tags.includes(g);
            return (
              <button
                key={g}
                type="button"
                aria-pressed={on}
                onClick={() => setTags((t) => (on ? t.filter((x) => x !== g) : [...t, g]))}
                className={
                  "min-h-11 rounded-full border px-3.5 text-[13px] font-semibold " +
                  (on
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-surface")
                }
              >
                {g}
              </button>
            );
          })}
        </div>
      </div>

      <section aria-label="Comidas del plan" className="flex flex-col gap-2">
        <h2 className="font-display text-2xl font-normal">Comidas</h2>
        {list.length === 0 ? (
          <p className="text-sm text-muted">Todavía no agregaste comidas.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {list.map((i) => (
              <li
                key={i.key}
                className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-1"
              >
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{i.title}</span>
                <button
                  type="button"
                  aria-label={`Menos ${i.title}`}
                  disabled={i.quantity <= 1}
                  onClick={() =>
                    setList((p) =>
                      p.map((x) => (x.key === i.key ? { ...x, quantity: x.quantity - 1 } : x)),
                    )
                  }
                  className="flex size-11 items-center justify-center rounded-full disabled:opacity-30"
                >
                  <Minus className="size-4" aria-hidden="true" />
                </button>
                <span className="w-6 text-center text-sm font-bold">×{i.quantity}</span>
                <button
                  type="button"
                  aria-label={`Más ${i.title}`}
                  onClick={() =>
                    setList((p) =>
                      p.map((x) => (x.key === i.key ? { ...x, quantity: x.quantity + 1 } : x)),
                    )
                  }
                  className="flex size-11 items-center justify-center rounded-full"
                >
                  <Plus className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Quitar ${i.title}`}
                  onClick={() => setList((p) => p.filter((x) => x.key !== i.key))}
                  className="flex size-11 items-center justify-center rounded-full text-muted"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <RecipePicker onPick={(r) => add({ recipeId: r.id, title: r.title })} />
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const t = freeText.trim();
            if (!t) return;
            add({ recipeId: null, title: t });
            setFreeText("");
          }}
        >
          <label htmlFor="free-meal" className="sr-only">
            Agregar una comida escrita
          </label>
          <input
            id="free-meal"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="O escribí una comida…"
            className="min-h-12 min-w-0 flex-1 rounded-full border border-border bg-surface px-4 text-[15px] outline-none"
          />
          <button
            type="submit"
            aria-label="Agregar comida escrita"
            className="flex size-12 flex-none items-center justify-center rounded-full bg-accent text-accent-foreground"
          >
            <Plus className="size-5" />
          </button>
        </form>
      </section>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="plan-notes">Pautas y notas para el paciente</Label>
        <Textarea
          id="plan-notes"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={isTemplate}
          onChange={(e) => setIsTemplate(e.target.checked)}
          className="size-5"
        />
        Guardar como plantilla
      </label>

      <div className="flex flex-col gap-2">
        <PillButton fullWidth disabled={pending || !title.trim()} onClick={save}>
          Guardar plan
        </PillButton>
        {plan ? (
          <PillButton fullWidth variant="outline" size="md" disabled={pending} onClick={remove}>
            Borrar plan
          </PillButton>
        ) : null}
      </div>
    </div>
  );
}
