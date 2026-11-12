import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getRecipeQuestions } from "@/lib/ai/assistant/queries";
import { getCookingSummary } from "@/lib/cooking/queries";
import { checkRecipe } from "@/lib/domain/compatibility";
import { getMyGroups } from "@/lib/groups/queries";
import { getGroupDiets, loadIngredientsForCheck } from "@/lib/recipes/compatibility";
import { getActiveShareUrl, getShareContacts } from "@/lib/recipes/share-queries";
import { getRecipe } from "@/lib/recipes/queries";
import { RecipeDetail } from "@/components/recipes/recipe-detail/recipe-detail";

export const metadata = { title: "Receta" };

export default async function Page({
  params,
}: {
  params: Promise<{ groupId: string; id: string }>;
}) {
  const user = await requireUser();
  const { groupId, id } = await params;
  const recipe = await getRecipe(id, user.id);
  if (!recipe || recipe.group_id !== groupId) notFound();

  const [cooking, groups, contacts, initialShareUrl, questions, diets, checked] = await Promise.all(
    [
      getCookingSummary(recipe.id, user.id),
      getMyGroups(user.id),
      getShareContacts(user.id),
      getActiveShareUrl(recipe.id),
      getRecipeQuestions(recipe.id),
      getGroupDiets(groupId),
      loadIngredientsForCheck([recipe.id]),
    ],
  );

  // Para quién va: estado por persona y razones; ingredientes problemáticos por fila.
  const items = checked.get(recipe.id) ?? [];
  const members = diets.map((d) => {
    const result = checkRecipe(
      items.map((i) => i.check),
      d.restrictions,
    );
    return {
      userId: d.userId,
      name: d.displayName,
      status: result.status,
      reasons: result.reasons,
    };
  });
  const rank = { unknown: 1, limit: 2, forbidden: 3 } as const;
  const ingredientProblems: Record<string, "unknown" | "limit" | "forbidden"> = {};
  for (const item of items) {
    for (const m of members) {
      for (const r of m.reasons) {
        if (r.ingredient !== item.check.name) continue;
        const prev = ingredientProblems[item.id];
        if (!prev || rank[r.severity as keyof typeof rank] > rank[prev])
          ingredientProblems[item.id] = r.severity as keyof typeof rank;
      }
    }
  }

  return (
    <RecipeDetail
      groupId={groupId}
      recipe={recipe}
      cooking={cooking}
      questions={questions}
      forWhom={members}
      ingredientProblems={ingredientProblems}
      share={{
        groups: groups.map((g) => ({ id: g.id, name: g.name, emoji: g.emoji })),
        contacts,
        initialShareUrl,
      }}
    />
  );
}
