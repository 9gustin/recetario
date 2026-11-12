"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PillButton } from "@/components/shared/pill-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { CookingEdit, EditIngredient, EditStep } from "@/lib/domain/apply-cooking-edits";
import { parseIngredientLine } from "@/lib/domain/ingredient-line";
import { roundQuantity, scaleQuantity } from "@/lib/domain/scale";

type StepIngredient = { index: number; ingredient: EditIngredient };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stepIndex: number;
  step: EditStep;
  stepCount: number;
  /** Ingredientes del paso, con su posición en la lista de la receta. */
  ingredients: StepIngredient[];
  baseServings: number;
  servings: number;
  onApply: (edits: CookingEdit[]) => void;
};

const toNumber = (value: string): number => Number(value.trim().replace(",", "."));

function minutesOf(seconds: number | null): string {
  return seconds ? String(Math.round((seconds / 60) * 100) / 100) : "";
}

type FormProps = Omit<Props, "open" | "onOpenChange"> & { onDone: () => void };

function EditForm({
  stepIndex,
  step,
  stepCount,
  ingredients,
  baseServings,
  servings,
  onApply,
  onDone,
}: FormProps) {
  const initialQty = (ing: EditIngredient) =>
    ing.quantity === null
      ? ""
      : String(roundQuantity(scaleQuantity(ing.quantity, baseServings, servings), ing.unit));

  const [mode, setMode] = useState<"edit" | "add" | "delete">("edit");
  const [text, setText] = useState(step.instruction);
  const [minutes, setMinutes] = useState(minutesOf(step.duration_seconds));
  const [qty, setQty] = useState<Record<number, string>>(
    Object.fromEntries(ingredients.map(({ index, ingredient }) => [index, initialQty(ingredient)])),
  );
  const [newText, setNewText] = useState("");
  const [newMinutes, setNewMinutes] = useState("");

  function save() {
    const edits: CookingEdit[] = [];
    if (text.trim() && text.trim() !== step.instruction) {
      edits.push({ op: "edit_text", step: stepIndex, text: text.trim() });
    }
    if (minutes !== minutesOf(step.duration_seconds)) {
      const m = toNumber(minutes);
      edits.push({
        op: "set_duration",
        step: stepIndex,
        seconds: minutes.trim() && m > 0 ? Math.round(m * 60) : null,
      });
    }
    for (const { index, ingredient } of ingredients) {
      const typed = qty[index] ?? "";
      if (typed === initialQty(ingredient) || ingredient.quantity === null) continue;
      const value = toNumber(typed);
      if (value > 0) {
        // Se escribe la cantidad para las porciones actuales; se guarda para las de la receta.
        edits.push({
          op: "set_ingredient_qty",
          ingredient: index,
          quantity: scaleQuantity(value, servings, baseServings),
        });
      }
    }
    if (edits.length > 0) onApply(edits);
    onDone();
  }

  function addStep() {
    const m = toNumber(newMinutes);
    onApply([
      {
        op: "add_step_after",
        step: stepIndex,
        text: newText.trim(),
        seconds: newMinutes.trim() && m > 0 ? Math.round(m * 60) : null,
      },
    ]);
    onDone();
  }

  if (mode === "add") {
    return (
      <div className="flex flex-col gap-4 px-4 pb-6">
        <div className="grid gap-2">
          <Label htmlFor="new-step-text">Paso nuevo (va después de este)</Label>
          <Textarea
            id="new-step-text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Qué hay que hacer"
            className="min-h-24 text-base"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="new-step-min">Duración en minutos (opcional)</Label>
          <Input
            id="new-step-min"
            inputMode="decimal"
            value={newMinutes}
            onChange={(e) => setNewMinutes(e.target.value)}
            className="min-h-12 text-base"
          />
        </div>
        <div className="flex gap-2">
          <PillButton disabled={!newText.trim()} onClick={addStep}>
            Agregar paso
          </PillButton>
          <PillButton variant="outline" onClick={() => setMode("edit")}>
            Volver
          </PillButton>
        </div>
      </div>
    );
  }

  if (mode === "delete") {
    return (
      <div className="flex flex-col gap-4 px-4 pb-6">
        <p className="text-[15px]">
          ¿Borrar este paso de la receta? Podés volver atrás al terminar.
        </p>
        <div className="flex gap-2">
          <PillButton
            onClick={() => {
              onApply([{ op: "delete_step", step: stepIndex }]);
              onDone();
            }}
          >
            Sí, borrar
          </PillButton>
          <PillButton variant="outline" onClick={() => setMode("edit")}>
            Cancelar
          </PillButton>
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-h-[70dvh] flex-col gap-4 overflow-y-auto px-4 pb-6">
      <div className="grid gap-2">
        <Label htmlFor="edit-step-text">Texto del paso</Label>
        <Textarea
          id="edit-step-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-28 text-base"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="edit-step-min">Duración en minutos (vacío = sin timer)</Label>
        <Input
          id="edit-step-min"
          inputMode="decimal"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          className="min-h-12 text-base"
        />
      </div>

      {ingredients.length > 0 ? (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">
            Cantidades (para {servings} porciones)
          </legend>
          {ingredients.map(({ index, ingredient }) => (
            <div key={ingredient.id} className="flex items-center gap-3">
              <Label htmlFor={`qty-${index}`} className="min-w-0 flex-1 truncate font-normal">
                {parseIngredientLine(ingredient.raw_text ?? "").name || ingredient.raw_text}
              </Label>
              <Input
                id={`qty-${index}`}
                inputMode="decimal"
                disabled={ingredient.quantity === null}
                value={qty[index] ?? ""}
                onChange={(e) => setQty((prev) => ({ ...prev, [index]: e.target.value }))}
                className="min-h-12 w-24 text-right text-base"
              />
              <span className="w-12 text-sm text-muted">{ingredient.unit ?? ""}</span>
            </div>
          ))}
        </fieldset>
      ) : null}

      <PillButton fullWidth onClick={save}>
        Guardar cambios
      </PillButton>
      <div className="flex gap-2">
        <PillButton variant="soft" size="md" className="flex-1" onClick={() => setMode("add")}>
          <Plus /> Agregar paso
        </PillButton>
        <PillButton
          variant="outline"
          size="md"
          className="flex-1"
          disabled={stepCount <= 1}
          onClick={() => setMode("delete")}
        >
          <Trash2 /> Borrar paso
        </PillButton>
      </div>
    </div>
  );
}

/** Hoja para ajustar el paso actual mientras se cocina. Los cambios valen para esta sesión. */
export function EditStepSheet({ open, onOpenChange, ...props }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>Ajustar el paso {props.stepIndex + 1}</SheetTitle>
          <SheetDescription>
            Se ve al instante. Al terminar elegís si queda en la receta.
          </SheetDescription>
        </SheetHeader>
        {open ? (
          <EditForm
            key={`${props.stepIndex}:${props.step.id}:${props.step.instruction}`}
            {...props}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
