"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { PillButton } from "@/components/shared/pill-button";
import type { Proposal } from "@/lib/ai/assistant/events";
import { addRecipeNote, applyRecipeChangeProposal } from "@/lib/ai/assistant/actions";
import { addManualItem } from "@/lib/shopping/actions";
import { chooseForToday } from "@/lib/suggest/actions";

type Props = {
  proposal: Proposal;
  groupId: string;
  /** En modo cocinar los cambios van a la sesión en vez de a la receta (T5B.4). */
  onApplyInSession?: (proposal: Extract<Proposal, { kind: "recipe_change" }>) => void;
};

/** Tarjeta de propuesta: el asistente propone, la persona confirma antes de que se guarde. */
export function ProposalCard(props: Props) {
  const { proposal, groupId } = props;
  if (proposal.kind === "navigate")
    return (
      <div
        className="flex flex-col gap-2 rounded-2xl border border-accent/60 bg-background p-3"
        role="group"
        aria-label="Ir a una sección"
      >
        <PillButton asChild size="md">
          <Link href={proposal.href}>Ir a {proposal.label}</Link>
        </PillButton>
      </div>
    );
  if (proposal.kind === "add_to_plan" || proposal.kind === "add_to_list")
    return <SimpleProposal proposal={proposal} groupId={groupId} />;
  return <RecipeProposal {...props} proposal={proposal} />;
}

/** Sumar una receta al plan de hoy o un ítem a la lista de compras: un toque para confirmar. */
function SimpleProposal({
  proposal,
  groupId,
}: {
  proposal: Extract<Proposal, { kind: "add_to_plan" | "add_to_list" }>;
  groupId: string;
}) {
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const isPlan = proposal.kind === "add_to_plan";

  function confirm() {
    start(async () => {
      const res = isPlan
        ? await chooseForToday({ groupId, recipeId: proposal.recipeId })
        : await addManualItem({ listId: proposal.listId, name: proposal.itemName });
      if (!res.ok) return void toast.error(res.error);
      setDone(true);
    });
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-2xl border border-accent/60 bg-background p-3"
      role="group"
      aria-label={isPlan ? "Sumar al plan de hoy" : "Sumar a la lista"}
    >
      <p className="text-xs font-bold tracking-wide text-accent uppercase">
        {isPlan ? "Sumar al plan de hoy" : "Sumar a la lista de compras"}
      </p>
      <p className="text-sm">
        {isPlan ? proposal.recipeTitle : `${proposal.itemName} → ${proposal.listName}`}
      </p>
      {done ? (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-success" role="status">
          <Check className="size-4" aria-hidden="true" /> Listo
        </p>
      ) : (
        <PillButton size="md" disabled={pending} onClick={confirm}>
          Confirmar
        </PillButton>
      )}
    </div>
  );
}

function RecipeProposal({
  proposal,
  groupId,
  onApplyInSession,
}: Props & { proposal: Extract<Proposal, { kind: "recipe_change" | "note" }> }) {
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
