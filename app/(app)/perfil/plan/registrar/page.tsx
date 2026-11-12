import { redirect } from "next/navigation";
import { LogMeal } from "@/components/diet-plan/log-meal";
import { ShareSummary } from "@/components/diet-plan/share-summary";
import { WeekGrid } from "@/components/diet-plan/week-grid";
import { requireUser } from "@/lib/auth";
import { recentWeeks, weekAdherence, todayPlan, type PlanMeal } from "@/lib/domain/adherence";
import { encouragement, summarizeWeek } from "@/lib/domain/diet-summary";
import type { MealSlot } from "@/lib/domain/meal-slots";
import { hourIn } from "@/lib/domain/today";
import { addDays, formatWeekLabel, todayString, weekDays, weekStartOf } from "@/lib/domain/week";
import { getActiveDietPlan, getMealLogs } from "@/lib/diet-plan/queries";
import { getNow } from "@/lib/now";

export const metadata = { title: "Registrar" };

export default async function Page() {
  await requireUser();
  const plan = await getActiveDietPlan();
  if (!plan) redirect("/perfil/plan");

  const now = await getNow();
  const today = todayString(now);
  const weekStart = weekStartOf(today, 1);
  const weeks = recentWeeks(weekStart, 5);
  const allLogs = await getMealLogs(weeks[weeks.length - 1]!, addDays(weekStart, 6));
  const logs = allLogs.filter((l) => l.date >= weekStart);
  const meals: PlanMeal[] = plan.meals.map((m) => ({
    id: m.id,
    slot: m.slot as MealSlot,
    days: m.days,
    formula: m.formula ?? "",
  }));
  const adherence = weekAdherence(
    logs,
    { meals, allowancesPerWeek: plan.allowances.per_week ?? 0 },
    weekStart,
    today,
  );

  // Opciones: las comidas de cada día de la semana que ya empezó; la de ahora (por hora) queda seleccionada.
  const options = weekDays(weekStart)
    .filter((d) => d <= today)
    .flatMap((date) =>
      todayPlan({ meals }, date).map((m) => ({ date, slot: m.slot, formula: m.formula })),
    );
  const hour = hourIn(now);
  const wanted: MealSlot =
    hour < 11 ? "breakfast" : hour < 15 ? "lunch" : hour < 19 ? "merienda" : "dinner";
  const todays = options.filter((o) => o.date === today);
  const pick = todays.find((o) => o.slot === wanted) ?? todays[0] ?? options[options.length - 1];
  const initial = Math.max(0, pick ? options.indexOf(pick) : 0);

  return (
    <main className="flex flex-col gap-5 px-5 pt-5 pb-8">
      <h1 className="font-display text-[28px] leading-[1.05] font-normal">Registrar</h1>
      <LogMeal options={options} initial={initial} allowancesLeft={adherence.allowancesLeft} />

      <section className="flex flex-col gap-3" aria-labelledby="semana">
        <h2 id="semana" className="font-display text-xl font-normal">
          Tu semana · {adherence.percent}%
        </h2>
        <WeekGrid adherence={adherence} />
        <p className="text-sm">{encouragement(adherence)}</p>
        <div>
          <ShareSummary text={summarizeWeek(plan.title, weekStart, adherence)} />
        </div>
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="historial">
        <h2 id="historial" className="font-display text-xl font-normal">
          Semanas anteriores
        </h2>
        <ul className="flex flex-col gap-1.5">
          {weeks.slice(1).map((w) => {
            const a = weekAdherence(
              allLogs.filter((l) => l.date >= w && l.date <= addDays(w, 6)),
              { meals, allowancesPerWeek: plan.allowances.per_week ?? 0 },
              w,
              addDays(w, 6),
            );
            return (
              <li
                key={w}
                className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 text-[15px]"
              >
                <span>{formatWeekLabel(w)}</span>
                <span className="font-semibold">{a.percent}%</span>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
