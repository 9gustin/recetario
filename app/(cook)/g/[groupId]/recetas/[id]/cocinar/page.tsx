import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getResumableSession } from "@/lib/cooking/queries";
import { getRecipe } from "@/lib/recipes/queries";
import { CookingStories } from "@/components/cooking/cooking-stories";

export const metadata = { title: "Cocinar" };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string; id: string }>;
  searchParams: Promise<{ entry?: string }>;
}) {
  const user = await requireUser();
  const { groupId, id } = await params;
  const { entry } = await searchParams;
  const planEntryId = entry && /^[0-9a-f-]{36}$/i.test(entry) ? entry : undefined;
  const recipe = await getRecipe(id, user.id);
  if (!recipe || recipe.group_id !== groupId) notFound();

  const resume = await getResumableSession(recipe.id, user.id, recipe.steps.length);

  return (
    <CookingStories groupId={groupId} recipe={recipe} resume={resume} planEntryId={planEntryId} />
  );
}
