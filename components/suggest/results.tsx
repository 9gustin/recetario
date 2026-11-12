"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChefHat, Clock } from "lucide-react";
import { toast } from "sonner";
import { PillButton } from "@/components/shared/pill-button";
import { chooseForToday } from "@/lib/suggest/actions";
import type { SuggestCard } from "@/lib/schemas/suggest";

/** Tarjetas de sugerencias: cobertura, motivo y "Elegir para hoy". */
export function SuggestResults({ groupId, cards }: { groupId: string; cards: SuggestCard[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [chosen, setChosen] = useState<string | null>(null);

  function choose(card: SuggestCard) {
    setChosen(card.recipeId);
    start(async () => {
      const res = await chooseForToday({ groupId, recipeId: card.recipeId });
      if (!res.ok) {
        setChosen(null);
        return void toast.error(res.error);
      }
      toast.success("¡Listo! Está en el plan de hoy.");
      router.push(`/g/${groupId}/hoy`);
    });
  }

  if (cards.length === 0) {
    return (
      <p role="status" className="px-5 py-6 text-center text-sm text-muted">
        No encontramos nada que se pueda hacer con eso. Probá sumando algún ingrediente más.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3 px-4 pb-8" aria-label="Sugerencias">
      {cards.map((c) => (
        <li key={c.recipeId} className="flex flex-col gap-2.5 rounded-2xl bg-surface p-4">
          <div className="flex items-start gap-3">
            <span
              className="flex size-12 flex-none items-center justify-center overflow-hidden rounded-xl bg-hero text-xl"
              aria-hidden="true"
            >
              {c.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
              ) : (
                "🍽️"
              )}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] leading-tight font-semibold">
                {c.title}
                {c.isNew ? <span className="ml-2 text-xs font-bold text-accent">Nueva</span> : null}
              </h3>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                {c.totalMinutes ? (
                  <>
                    <Clock className="size-3.5" aria-hidden="true" /> {c.totalMinutes} min ·{" "}
                  </>
                ) : null}
                {c.label}
              </p>
            </div>
          </div>
          <p className="text-sm">{c.reason ?? c.line}</p>
          <div className="flex gap-2">
            <PillButton
              size="md"
              className="flex-1"
              disabled={pending}
              onClick={() => choose(c)}
              aria-busy={chosen === c.recipeId}
            >
              <ChefHat /> Elegir para hoy
            </PillButton>
            <PillButton asChild size="md" variant="outline">
              <Link href={`/g/${groupId}/recetas/${c.recipeId}`}>Ver</Link>
            </PillButton>
          </div>
        </li>
      ))}
    </ul>
  );
}
