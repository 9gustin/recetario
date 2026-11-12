import Link from "next/link";
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
      <nav aria-label="Más" className="flex gap-2 pb-2 text-sm font-semibold">
        <Link
          href={`/g/${groupId}/recetas/colecciones`}
          className="flex min-h-11 items-center rounded-full border border-border px-3.5"
        >
          Colecciones
        </Link>
        <Link
          href="/explorar"
          className="flex min-h-11 items-center rounded-full border border-border px-3.5"
        >
          Explorar recetas públicas
        </Link>
      </nav>
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
