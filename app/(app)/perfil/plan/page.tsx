import Link from "next/link";
import { Pencil } from "lucide-react";
import { Allowances } from "@/components/diet-plan/allowances";
import { TodayPlan } from "@/components/diet-plan/today-plan";
import { PillButton } from "@/components/shared/pill-button";
import { requireUser } from "@/lib/auth";
import { todayPlan, weekAdherence, type PlanMeal } from "@/lib/domain/adherence";
import type { MealSlot } from "@/lib/domain/meal-slots";
import { addDays, daysBetween, todayString, weekStartOf } from "@/lib/domain/week";
import { getActiveDietPlan, getMealLogs } from "@/lib/diet-plan/queries";
import { getNow } from "@/lib/now";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Mi plan" };

export default async function Page() {
  const user = await requireUser();
  const plan = await getActiveDietPlan();
  if (!plan) {
    return (
      <main className="flex flex-col gap-4 px-5 pt-5">
        <h1 className="font-display text-[28px] font-normal">Mi plan</h1>
        <p className="text-sm text-muted">Todavía no cargaste el plan de tu nutricionista.</p>
        <PillButton asChild fullWidth>
          <Link href="/perfil/plan/digitalizar">Digitalizar mi plan</Link>
        </PillButton>
      </main>
    );
  }

  const now = await getNow();
  const today = todayString(now);
  const weekStart = weekStartOf(today, 1);
  const logs = await getMealLogs(weekStart, addDays(weekStart, 6));
  const meals: PlanMeal[] = plan.meals.map((m) => ({
    id: m.id,
    slot: m.slot as MealSlot,
    days: m.days,
    formula: m.formula ?? "",
  }));
  const allowancesPerWeek = plan.allowances.per_week ?? 0;
  const adherence = weekAdherence(logs, { meals, allowancesPerWeek }, weekStart, today);
  const todays = todayPlan(
    {
      meals,
      swaps: plan.swaps.map((s) => ({
        mealId: s.meal_id,
        original: s.original,
        replacement: s.replacement,
      })),
    },
    today,
    logs,
  );

  // Lo que figura hoy en el plan semanal de los grupos de la persona, por momento.
  const supabase = await createClient();
  const { data: planned } = await supabase
    .from("meal_plan_entries")
    .select("slot, free_text, recipes(title)")
    .eq("date", today);
  const inPlan: Record<string, string> = {};
  for (const e of planned ?? []) if (e.slot) inPlan[e.slot] ??= e.recipes?.title ?? e.free_text ?? "";

  const weekNumber = plan.starts_on ? Math.floor(daysBetween(plan.starts_on, today) / 7) + 1 : null;
  const totalWeeks =
    plan.starts_on && plan.ends_on
      ? Math.max(1, Math.round(daysBetween(plan.starts_on, plan.ends_on) / 7))
      : null;
  void user;

  return (
    <main className="flex flex-col gap-5 px-5 pt-5 pb-8">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="font-display text-[28px] leading-[1.05] font-normal">Mi plan</h1>
          <p className="text-sm text-muted">
            {weekNumber ? `Semana ${weekNumber}${totalWeeks ? ` de ${totalWeeks}` : ""} · ` : ""}lo
            ajustaste {Math.max(0, plan.version - 1)} {plan.version === 2 ? "vez" : "veces"}
          </p>
        </div>
        <Link
          href="/perfil/plan/digitalizar"
          aria-label="Ajustar mi plan"
          className="flex size-11 items-center justify-center rounded-full border border-border"
        >
          <Pencil className="size-5" />
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-hero p-3.5">
          <p className="text-xs font-bold tracking-wide uppercase">Cumplido</p>
          <p className="font-display text-[36px] leading-none">{adherence.percent}%</p>
          <p className="text-xs text-foreground/80">esta semana</p>
        </div>
        <Allowances perWeek={allowancesPerWeek} used={adherence.allowancesUsed} />
      </div>

      <section className="flex flex-col gap-2" aria-labelledby="hoy-toca">
        <h2 id="hoy-toca" className="font-display text-xl font-normal">
          Hoy toca
        </h2>
        <TodayPlan meals={todays} inPlan={inPlan} />
      </section>

      {plan.swaps.length > 0 ? (
        <section className="flex flex-col gap-2" aria-labelledby="reemplazos">
          <h2 id="reemplazos" className="font-display text-xl font-normal">
            Tus reemplazos
          </h2>
          <ul className="flex flex-wrap gap-2">
            {plan.swaps.map((s) => (
              <li
                key={s.id}
                className="rounded-full bg-hero px-3.5 py-1.5 text-[13px] font-semibold"
              >
                {s.original} → {s.replacement}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <PillButton asChild fullWidth>
        <Link href="/perfil/plan/registrar">Registrar lo que comí</Link>
      </PillButton>
    </main>
  );
}
