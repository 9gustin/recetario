import { requireUser } from "@/lib/auth";
import { getGroupDiets } from "@/lib/recipes/compatibility";
import { getRecipeFacets } from "@/lib/recipes/queries";
import { searchRecipes } from "@/lib/recipes/actions";
import { RECIPES_PAGE_SIZE } from "@/lib/schemas/recipe-search";
import { RecipeList } from "@/components/recipes/recipe-list";

export const metadata = { title: "Recetas" };

export default async function Page({ params }: { params: Promise<{ groupId: string }> }) {
  await requireUser();
  const { groupId } = await params;
  const [{ topTags, total }, diets, first] = await Promise.all([
    getRecipeFacets(groupId),
    getGroupDiets(groupId),
    searchRecipes({ groupId, offset: 0, limit: RECIPES_PAGE_SIZE }),
  ]);
  const members = diets.map((d) => ({ id: d.userId, name: d.displayName?.trim() || "Alguien" }));
  return (
    <div className="flex flex-col px-5 pt-2">
      <RecipeList
        groupId={groupId}
        topTags={topTags}
        total={total}
        members={members}
        initial={first.ok ? first.data : undefined}
      />
    </div>
  );
}
