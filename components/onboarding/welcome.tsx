"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChefHat, Salad, Users } from "lucide-react";
import { PillButton } from "@/components/shared/pill-button";
import { completeOnboarding } from "@/lib/onboarding/actions";

const STEPS = [
  {
    icon: Users,
    title: "¿Con quién cocinás?",
    text: "Armá un grupo con tu familia o tu pareja para compartir recetas, el plan y la lista de compras.",
    cta: "Crear un grupo",
    href: () => "/grupos/nuevo",
  },
  {
    icon: ChefHat,
    title: "Cargá 3 recetas que hacen siempre",
    text: "Dictalas, sacales una foto o escribilas. En un minuto tenés la primera.",
    cta: "Cargar una receta",
    href: (g: string) => `/g/${g}/recetas/importar`,
  },
  {
    icon: Salad,
    title: "Contanos cómo comen",
    text: "Qué no pueden comer, qué les gusta, si siguen un plan. Así cuidamos cada comida.",
    cta: "Contar cómo como",
    href: () => "/perfil/alimentacion",
  },
] as const;

/** Tres pantallas salteables; cada una lleva a la pantalla real y se puede volver desde el checklist de "Hoy". */
export function Welcome({
  personalGroupId,
  done,
}: {
  personalGroupId: string;
  done: [boolean, boolean, boolean];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();
  const current = STEPS[step]!;
  const Icon = current.icon;
  const last = step === STEPS.length - 1;

  function finish() {
    start(async () => {
      await completeOnboarding();
      router.replace(`/g/${personalGroupId}/hoy`);
    });
  }

  return (
    <main className="flex min-h-dvh flex-col justify-between gap-6 px-6 py-10">
      <div className="flex flex-col items-center gap-5 pt-10 text-center">
        <p className="text-xs font-bold tracking-wide text-muted uppercase" aria-live="polite">
          {step + 1} de {STEPS.length}
        </p>
        <span className="flex size-24 items-center justify-center rounded-full bg-hero">
          <Icon className="size-10" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <h1 className="font-display text-[32px] leading-[1.05] font-normal">{current.title}</h1>
        <p className="max-w-[300px] text-[15px] text-muted">{current.text}</p>
        {done[step] ? <p className="text-sm font-semibold text-success">Ya lo hiciste ✓</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <PillButton asChild fullWidth disabled={pending}>
          <Link href={current.href(personalGroupId)} onClick={() => void completeOnboarding()}>
            {current.cta}
          </Link>
        </PillButton>
        <PillButton
          fullWidth
          variant="outline"
          disabled={pending}
          onClick={last ? finish : () => setStep(step + 1)}
        >
          {last ? "Entrar a la app" : "Más tarde"}
        </PillButton>
        {!last ? (
          <button type="button" onClick={finish} className="min-h-11 text-sm text-muted underline">
            Saltear todo
          </button>
        ) : null}
      </div>
    </main>
  );
}
