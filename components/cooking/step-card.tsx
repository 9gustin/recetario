import type { ReactNode } from "react";
import {
  formatClock,
  instructionFontSize,
  scaledIngredientLabel,
  type CookingIngredient,
} from "@/lib/domain/cooking-display";

type Props = {
  instruction: string;
  tip: string | null;
  durationSeconds: number | null;
  ingredients: CookingIngredient[];
  baseServings: number;
  servings: number;
  /** Aquí van los controles del timer (T3.3). */
  timerSlot?: ReactNode;
};

/** Contenido de un paso: instrucción grande, ingredientes escalados, tip y duración. */
export function StepCard({
  instruction,
  tip,
  durationSeconds,
  ingredients,
  baseServings,
  servings,
  timerSlot,
}: Props) {
  return (
    <div className="flex h-full flex-col gap-5">
      <h1
        className="font-display font-normal text-balance"
        style={{ fontSize: instructionFontSize(instruction), lineHeight: 1.15 }}
      >
        {instruction}
      </h1>

      {ingredients.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {ingredients.map((ing) => (
            <li key={ing.id} className="rounded-xl bg-surface px-3 py-2 text-sm">
              {scaledIngredientLabel(ing, baseServings, servings)}
            </li>
          ))}
        </ul>
      ) : null}

      {tip ? (
        <p className="rounded-[14px] bg-surface px-3.5 py-3 text-sm leading-[1.45] text-foreground/90">
          <strong className="text-accent">Tip:</strong> {tip}
        </p>
      ) : null}

      {durationSeconds ? (
        <div className="flex items-center gap-4 rounded-[22px] bg-surface p-4">
          <div className="flex-1">
            <p className="font-display text-[40px] leading-none">{formatClock(durationSeconds)}</p>
            <p className="mt-1 text-[13px] text-muted">Tiempo del paso</p>
          </div>
          {timerSlot}
        </div>
      ) : null}
    </div>
  );
}
