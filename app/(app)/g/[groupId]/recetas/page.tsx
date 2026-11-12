import { requireUser } from "@/lib/auth";
import { getRecipeFacets } from "@/lib/recipes/queries";
import { RecipeList } from "@/components/recipes/recipe-list";

export const metadata = { title: "Recetas" };

export default async function Page({ params }: { params: Promise<{ groupId: string }> }) {
  await requireUser();
  const { groupId } = await params;
  const { topTags, total } = await getRecipeFacets(groupId);
  return (
    <div className="flex flex-col px-5 pt-2">
      <RecipeList groupId={groupId} topTags={topTags} total={total} />
    </div>
  );
}
