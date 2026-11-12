import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCookingSummary } from "@/lib/cooking/queries";
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

  const cooking = await getCookingSummary(recipe.id, user.id);

  return <RecipeDetail groupId={groupId} recipe={recipe} cooking={cooking} />;
}
