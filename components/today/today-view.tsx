import Link from "next/link";
import { ArrowRight, ChefHat, Flame, MessageSquare, Moon, Sparkles } from "lucide-react";
import { PrepToday } from "@/components/prep/prep-today";
import type { PrepTaskRow } from "@/lib/prep/actions";
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
  shopping,
  prep = [],
}: {
  groupId: string;
  today: string;
  groupName: string;
  resolution: TodayResolution;
  warnings: string[];
  prep?: PrepTaskRow[];
  shopping?: { listId: string; name: string; done: number; total: number } | null;
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
          >
            <form
              action={`/g/${groupId}/hoy/que-tenes`}
              method="get"
              className="flex items-center gap-2 rounded-full bg-background/80 pr-1.5 pl-4"
            >
              <label htmlFor="craving-q" className="sr-only">
                Qué tenés ganas de comer
              </label>
              <input
                id="craving-q"
                name="q"
                placeholder="Tengo ganas de algo con pollo…"
                className="min-h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
              />
              <button
                type="submit"
                aria-label="Buscar ideas"
                className="flex size-11 flex-none items-center justify-center rounded-full bg-accent text-accent-foreground"
              >
                <ArrowRight className="size-5" />
              </button>
            </form>
          </Hero>
          <ol className="flex flex-col gap-2 px-5" aria-label="Cómo arrancar">
            <li>
              <Link
                href={`/g/${groupId}/hoy/ideas`}
                className="flex min-h-14 items-center gap-3 rounded-2xl bg-surface px-4 py-3"
              >
                <span className="flex size-8 flex-none items-center justify-center rounded-full bg-hero text-sm font-bold">
                  1
                </span>
                <span>
                  <span className="block text-[15px] font-semibold">Elegí</span>
                  <span className="text-sm text-muted">
                    Ideas para hoy, con el motivo de cada una.
                  </span>
                </span>
              </Link>
            </li>
            <li>
              <Link
                href={`/g/${groupId}/hoy/que-tenes`}
                className="flex min-h-14 items-center gap-3 rounded-2xl bg-surface px-4 py-3"
              >
                <span className="flex size-8 flex-none items-center justify-center rounded-full bg-hero text-sm font-bold">
                  2
                </span>
                <span>
                  <span className="block text-[15px] font-semibold">Contame</span>
                  <span className="text-sm text-muted">
                    Decime qué tenés y te digo qué cocinar.
                  </span>
                </span>
              </Link>
            </li>
            <li>
              <Link
                href={`/g/${groupId}/plan`}
                className="flex min-h-14 items-center gap-3 rounded-2xl bg-surface px-4 py-3"
              >
                <span className="flex size-8 flex-none items-center justify-center rounded-full bg-hero text-sm font-bold">
                  3
                </span>
                <span>
                  <span className="block text-[15px] font-semibold">Planificá</span>
                  <span className="text-sm text-muted">Armá la semana a mano o con la IA.</span>
                </span>
              </Link>
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

      {prep.length > 0 ? <PrepToday tasks={prep} /> : null}

      {shopping && shopping.total > 0 ? (
        <Link
          href={`/g/${groupId}/compras/${shopping.listId}`}
          className="mx-5 flex min-h-14 items-center justify-between rounded-2xl bg-surface px-4 py-3"
        >
          <span>
            <span className="block text-[15px] font-semibold">{shopping.name}</span>
            <span className="text-sm text-muted">
              {shopping.done}/{shopping.total} listos
            </span>
          </span>
          <span aria-hidden="true">›</span>
        </Link>
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
