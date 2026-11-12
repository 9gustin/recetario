import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getRecipe } from "@/lib/recipes/queries";
import { RecipeForm } from "@/components/recipes/recipe-form/recipe-form";

export const metadata = { title: "Editar receta" };

export default async function Page({
  params,
}: {
  params: Promise<{ groupId: string; id: string }>;
}) {
  const user = await requireUser();
  const { groupId, id } = await params;
  const recipe = await getRecipe(id, user.id);
  if (!recipe || recipe.group_id !== groupId) notFound();

  return (
    <main className="flex flex-col gap-5 px-5 pt-5 pb-8">
      <h1 className="font-display text-[34px] leading-none font-normal">Editar receta</h1>
      <RecipeForm groupId={groupId} recipe={recipe} />
    </main>
  );
}
