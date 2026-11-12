import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UsePlan } from "@/components/public/use-plan";
import type { GroupOption } from "@/components/public/save-recipe";
import { slotLabel } from "@/lib/domain/meal-slots";
import { addDays, todayString, weekStartOf } from "@/lib/domain/week";
import { getMyGroups } from "@/lib/groups/queries";
import { getPublicPlan } from "@/lib/public/queries";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ slug: string }> };
const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const plan = await getPublicPlan(slug);
  if (!plan) return { title: "Plan no disponible", robots: { index: false } };
  return {
    title: plan.title,
    description: plan.description ?? "Plan semanal de comidas",
    alternates: { canonical: `/plan-publico/${slug}` },
  };
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  const plan = await getPublicPlan(slug);
  if (!plan) notFound();

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const groups: GroupOption[] | null = userId
    ? (await getMyGroups(userId)).map((g) => ({ id: g.id, name: g.name, emoji: g.emoji }))
    : null;
  const nextWeek = addDays(weekStartOf(todayString(), 1), 7);

  const days = DAYS.map((label, i) => ({
    label,
    entries: plan.entries.filter((e) => e.day === i),
  })).filter((d) => d.entries.length > 0);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-6">
      <header>
        <h1 className="font-display text-[32px] leading-[1.05] font-normal">{plan.title}</h1>
        {plan.description ? (
          <p className="mt-1 text-[15px] text-muted">{plan.description}</p>
        ) : null}
      </header>
      <UsePlan slug={slug} groups={groups} nextWeek={nextWeek} />
      <ol className="flex flex-col gap-4">
        {days.map((d) => (
          <li key={d.label} className="flex flex-col gap-1.5">
            <h2 className="text-xs font-bold tracking-wide text-muted uppercase">{d.label}</h2>
            <ul className="flex flex-col gap-1.5">
              {d.entries.map((e, n) => (
                <li key={n} className="rounded-2xl bg-surface px-4 py-3 text-[15px]">
                  <span className="text-xs text-muted">{slotLabel(e.slot)} · </span>
                  {e.recipe ? (
                    <Link
                      href={`/receta/${e.recipe.slug}`}
                      className="font-semibold underline-offset-2 hover:underline"
                    >
                      {e.recipe.title}
                    </Link>
                  ) : (
                    <span className="font-semibold">
                      {e.recipe_title ?? e.free_text ?? "Comida"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
