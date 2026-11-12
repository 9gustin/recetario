import Link from "next/link";
import { Check } from "lucide-react";
import type { OnboardingState } from "@/lib/onboarding/queries";
import { cn } from "@/lib/utils";

/** Pasos del arranque en "Hoy" hasta completarlos. */
export function Checklist({ groupId, state }: { groupId: string; state: OnboardingState }) {
  const items = [
    { done: state.hasGroup, label: "Crear un grupo", href: "/grupos/nuevo" },
    {
      done: state.hasRecipe,
      label: "Cargar tu primera receta",
      href: `/g/${groupId}/recetas/importar`,
    },
    { done: state.hasProfile, label: "Contar cómo comés", href: "/perfil/alimentacion" },
  ];
  if (items.every((i) => i.done)) return null;
  return (
    <section
      aria-label="Para arrancar"
      className="mx-5 flex flex-col gap-1.5 rounded-2xl border border-border p-3.5"
    >
      <h2 className="text-sm font-bold">Para arrancar</h2>
      <ul className="flex flex-col">
        {items.map((i) => (
          <li key={i.label}>
            <Link href={i.href} className="flex min-h-11 items-center gap-2.5 text-[15px]">
              <span
                className={cn(
                  "flex size-6 flex-none items-center justify-center rounded-full border-2",
                  i.done ? "border-accent bg-accent text-accent-foreground" : "border-border",
                )}
              >
                {i.done ? <Check className="size-4" aria-hidden="true" /> : null}
              </span>
              <span className={cn(i.done && "text-muted line-through")}>{i.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
