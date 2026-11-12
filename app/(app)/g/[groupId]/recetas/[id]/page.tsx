import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getRecipeQuestions } from "@/lib/ai/assistant/queries";
import { getCookingSummary } from "@/lib/cooking/queries";
import { getMyGroups } from "@/lib/groups/queries";
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

  const [cooking, groups, contacts, initialShareUrl, questions] = await Promise.all([
    getCookingSummary(recipe.id, user.id),
    getMyGroups(user.id),
    getShareContacts(user.id),
    getActiveShareUrl(recipe.id),
    getRecipeQuestions(recipe.id),
  ]);

  return (
    <RecipeDetail
      groupId={groupId}
      recipe={recipe}
      cooking={cooking}
      questions={questions}
      share={{
        groups: groups.map((g) => ({ id: g.id, name: g.name, emoji: g.emoji })),
        contacts,
        initialShareUrl,
      }}
    />
  );
}
