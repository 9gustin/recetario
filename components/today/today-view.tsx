import Link from "next/link";
import { ChefHat, Flame, MessageSquare, Moon, Sparkles } from "lucide-react";
import { Hero } from "@/components/shared/hero";
import { PillButton } from "@/components/shared/pill-button";
import type { TodayResolution, TodayEntry } from "@/lib/domain/today";
import { slotLabel } from "@/lib/domain/meal-slots";
import { dayLabel } from "@/lib/domain/week";

const EYEBROW: Record<string, string> = {
  breakfast: "A LA MAÑANA",
  lunch: "AL MEDIODÍA",
  merienda: "A LA TARDE",
  dinner: "ESTA NOCHE",
  snack: "PARA PICAR",
};

const Photo = ({ entry }: { entry: TodayEntry }) =>
  entry.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={entry.imageUrl} alt="" className="opacity-40" />
  ) : null;

function meta(entry: TodayEntry): string {
  const parts = [
    entry.totalMinutes ? `${entry.totalMinutes} min` : null,
    entry.isLeftover ? "sobras" : null,
  ];
  return parts.filter(Boolean).join(" · ");
}

/** Home "Hoy": cambia según haya o no comida planeada para hoy. */
export function TodayView({
  groupId,
  today,
  groupName,
  resolution,
  warnings,
}: {
  groupId: string;
  today: string;
  groupName: string;
  resolution: TodayResolution;
  warnings: string[];
}) {
  const { state, nextMeal, agenda, tomorrow } = resolution;
  const ask = (
    <PillButton asChild variant="soft" size="md">
      <Link href={`/g/${groupId}/preguntar`}>
        <MessageSquare /> Preguntar
      </Link>
    </PillButton>
  );
  const heroMeta = `${dayLabel(today)} · ${groupName}`;

  return (
    <div className="flex flex-1 flex-col gap-5 pb-8">
      {state === "planned" && nextMeal ? (
        <Hero
          meta={heroMeta}
          topRight={ask}
          image={<Photo entry={nextMeal} />}
          eyebrow={EYEBROW[nextMeal.slot]}
          title={nextMeal.title}
          subtitle={meta(nextMeal) || slotLabel(nextMeal.slot)}
          action={
            nextMeal.recipeId ? (
              <PillButton asChild fullWidth>
                <Link
                  href={`/g/${groupId}/recetas/${nextMeal.recipeId}/cocinar?entry=${nextMeal.id}`}
                >
                  {nextMeal.isLeftover ? (
                    <>
                      <Flame /> Calentar
                    </>
                  ) : (
                    <>
                      <ChefHat /> Empezar a cocinar
                    </>
                  )}
                </Link>
              </PillButton>
            ) : null
          }
        />
      ) : null}

      {state === "unplanned" ? (
        <>
          <Hero
            meta={heroMeta}
            topRight={ask}
            eyebrow="HOY"
            title="¿Qué comemos hoy?"
            subtitle="Todavía no hay nada planeado para hoy."
            action={
              <PillButton asChild fullWidth>
                <Link href={`/g/${groupId}/plan`}>
                  <Sparkles /> Planificar la semana
                </Link>
              </PillButton>
            }
          />
          <ol className="flex flex-col gap-2 px-5">
            <li className="rounded-2xl bg-surface p-4">
              <p className="text-[15px] font-semibold">Planificá</p>
              <p className="text-sm text-muted">Armá la semana a mano o con ayuda de la IA.</p>
            </li>
          </ol>
        </>
      ) : null}

      {state === "done_for_today" ? (
        <Hero
          meta={heroMeta}
          topRight={ask}
          eyebrow="LISTO POR HOY"
          title="Hoy ya está resuelto"
          subtitle="Descansá, que mañana seguimos."
        />
      ) : null}

      {warnings.length > 0 ? (
        <ul className="flex flex-col gap-2 px-5" aria-label="Recordatorios">
          {warnings.map((w) => (
            <li
              key={w}
              className="flex items-start gap-2 rounded-2xl bg-hero px-4 py-3 text-sm font-medium"
            >
              <Moon className="mt-0.5 size-4 flex-none" aria-hidden="true" /> {w}
            </li>
          ))}
        </ul>
      ) : null}

      {agenda.length > 0 ? (
        <section className="flex flex-col gap-2 px-5" aria-labelledby="resto">
          <h2 id="resto" className="font-display text-xl font-normal">
            El resto del día
          </h2>
          <ul className="flex flex-col gap-2">
            {agenda.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3">
                <span className="w-12 text-sm font-semibold text-muted">{a.time ?? ""}</span>
                <span className="text-[15px]">
                  {a.kind === "meal" ? `${slotLabel(a.entry.slot)} · ${a.entry.title}` : a.title}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tomorrow.length > 0 && state !== "planned" ? (
        <section className="flex flex-col gap-2 px-5" aria-labelledby="manana">
          <h2 id="manana" className="font-display text-xl font-normal">
            Mañana
          </h2>
          <ul className="flex flex-col gap-2">
            {tomorrow.map((t) => (
              <li key={t.id} className="rounded-2xl bg-surface px-4 py-3 text-[15px]">
                <span className="text-muted">{slotLabel(t.slot)} · </span>
                {t.title}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
