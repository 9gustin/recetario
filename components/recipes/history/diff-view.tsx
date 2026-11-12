import { Minus, Pencil, Plus } from "lucide-react";
import { ingredientLabel, isEmptyDiff, type RecipeDiff } from "@/lib/domain/recipe-diff";

const FIELD_LABELS: Record<string, string> = {
  title: "Título",
  description: "Descripción",
  servings: "Porciones",
  prep_minutes: "Preparación (min)",
  cook_minutes: "Cocción (min)",
  total_minutes: "Tiempo total (min)",
  difficulty: "Dificultad",
  tags: "Etiquetas",
};

function Row({ kind, children }: { kind: "add" | "remove" | "change"; children: React.ReactNode }) {
  const Icon = kind === "add" ? Plus : kind === "remove" ? Minus : Pencil;
  const color =
    kind === "add" ? "text-success" : kind === "remove" ? "text-danger-soft" : "text-muted";
  return (
    <li className="flex gap-2 text-sm">
      <Icon className={`mt-0.5 size-4 flex-none ${color}`} aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

/** Muestra qué cambió una versión respecto de la anterior. */
export function DiffView({ diff, initial }: { diff: RecipeDiff; initial: boolean }) {
  if (initial) return <p className="text-sm text-muted">Versión inicial de la receta.</p>;
  if (isEmptyDiff(diff)) return <p className="text-sm text-muted">Sin cambios de contenido.</p>;

  return (
    <div className="flex flex-col gap-3">
      {diff.fields.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {diff.fields.map((f) => (
            <Row key={f.field} kind="change">
              <strong className="font-semibold">{FIELD_LABELS[f.field]}:</strong>{" "}
              <span className="text-muted line-through">{f.from ?? "—"}</span> → {f.to ?? "—"}
            </Row>
          ))}
        </ul>
      ) : null}

      {diff.ingredients.added.length +
        diff.ingredients.removed.length +
        diff.ingredients.changed.length >
      0 ? (
        <div className="flex flex-col gap-1.5">
          <h4 className="text-xs font-bold tracking-wide text-muted uppercase">Ingredientes</h4>
          <ul className="flex flex-col gap-1.5">
            {diff.ingredients.added.map((i, k) => (
              <Row key={`a${k}`} kind="add">
                {ingredientLabel(i)}
              </Row>
            ))}
            {diff.ingredients.removed.map((i, k) => (
              <Row key={`r${k}`} kind="remove">
                {ingredientLabel(i)}
              </Row>
            ))}
            {diff.ingredients.changed.map((c, k) => (
              <Row key={`c${k}`} kind="change">
                <span className="text-muted line-through">{ingredientLabel(c.before)}</span> →{" "}
                {ingredientLabel(c.after)}
              </Row>
            ))}
          </ul>
        </div>
      ) : null}

      {diff.steps.added.length + diff.steps.removed.length + diff.steps.changed.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <h4 className="text-xs font-bold tracking-wide text-muted uppercase">Pasos</h4>
          <ul className="flex flex-col gap-1.5">
            {diff.steps.added.map((s) => (
              <Row key={`a${s.position}`} kind="add">
                Paso {s.position}: {s.instruction}
              </Row>
            ))}
            {diff.steps.removed.map((s) => (
              <Row key={`r${s.position}`} kind="remove">
                Paso {s.position}: {s.instruction}
              </Row>
            ))}
            {diff.steps.changed.map((s) => (
              <Row key={`c${s.position}`} kind="change">
                Paso {s.position}: <span className="text-muted line-through">{s.before}</span> →{" "}
                {s.after}
              </Row>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
