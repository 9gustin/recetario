"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { PillButton } from "@/components/shared/pill-button";
import type { Proposal } from "@/lib/ai/assistant/events";
import { addRecipeNote, applyRecipeChangeProposal } from "@/lib/ai/assistant/actions";

type Props = {
  proposal: Proposal;
  groupId: string;
  /** En modo cocinar los cambios van a la sesión en vez de a la receta (T5B.4). */
  onApplyInSession?: (proposal: Extract<Proposal, { kind: "recipe_change" }>) => void;
};

/** Tarjeta de propuesta: el asistente propone, la persona confirma antes de que se guarde. */
export function ProposalCard({ proposal, groupId, onApplyInSession }: Props) {
  const [step, setStep] = useState<"idle" | "confirm" | "done">("idle");
  const [pending, start] = useTransition();

  function confirm() {
    start(async () => {
      const res =
        proposal.kind === "recipe_change"
          ? await applyRecipeChangeProposal({
              recipeId: proposal.recipeId,
              changeNote: proposal.changeNote,
              ops: proposal.ops,
            })
          : await addRecipeNote({ recipeId: proposal.recipeId, text: proposal.text });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setStep("done");
    });
  }

  const title = proposal.kind === "recipe_change" ? "Cambio propuesto" : "Nota propuesta";

  return (
    <div
      className="flex flex-col gap-2 rounded-2xl border border-accent/60 bg-background p-3"
      role="group"
      aria-label={title}
    >
      <p className="text-xs font-bold tracking-wide text-accent uppercase">{title}</p>
      <p className="text-[13px] text-muted">En “{proposal.recipeTitle}”</p>
      {proposal.kind === "recipe_change" ? (
        <ul className="flex flex-col gap-0.5 text-sm">
          {proposal.summary.map((line, i) => (
            <li key={i}>• {line}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm">“{proposal.text}”</p>
      )}

      {step === "idle" ? (
        <div className="flex flex-wrap gap-2">
          {onApplyInSession && proposal.kind === "recipe_change" ? (
            <PillButton
              size="md"
              onClick={() => {
                onApplyInSession(proposal);
                setStep("done");
              }}
            >
              Aplicar en esta sesión
            </PillButton>
          ) : (
            <PillButton
              variant="outline"
              size="md"
              className="border-accent text-accent"
              onClick={() => setStep("confirm")}
            >
              {proposal.kind === "recipe_change" ? "Sumarlo a la receta" : "Anotar en la receta"}
            </PillButton>
          )}
        </div>
      ) : null}

      {step === "confirm" ? (
        <div className="flex flex-col gap-2 rounded-xl bg-surface-2 p-3">
          <p className="text-sm">
            {proposal.kind === "recipe_change"
              ? "Se guarda como una versión nueva de la receta. Podés volver atrás desde el historial."
              : "Se agrega al final de la descripción de la receta."}
          </p>
          <div className="flex gap-2">
            <PillButton size="md" disabled={pending} onClick={confirm}>
              {pending ? "Guardando…" : "Confirmar"}
            </PillButton>
            <PillButton
              variant="outline"
              size="md"
              disabled={pending}
              onClick={() => setStep("idle")}
            >
              Cancelar
            </PillButton>
          </div>
        </div>
      ) : null}

      {step === "done" ? (
        <p className="flex items-center gap-2 text-sm font-semibold text-success">
          <Check className="size-4" aria-hidden="true" />
          {onApplyInSession && proposal.kind === "recipe_change"
            ? "Aplicado en esta sesión"
            : "Listo, ya quedó guardado."}
          {!onApplyInSession ? (
            <Link
              href={`/g/${groupId}/recetas/${proposal.recipeId}`}
              className="ml-auto text-accent underline"
            >
              Ver receta
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
