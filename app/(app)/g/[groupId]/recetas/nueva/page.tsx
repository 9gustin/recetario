import { requireUser } from "@/lib/auth";
import { RecipeForm } from "@/components/recipes/recipe-form/recipe-form";

export const metadata = { title: "Nueva receta" };

export default async function Page({ params }: { params: Promise<{ groupId: string }> }) {
  await requireUser();
  const { groupId } = await params;
  return (
    <main className="flex flex-col gap-5 px-5 pt-5 pb-8">
      <h1 className="font-display text-[34px] leading-none font-normal">Nueva receta</h1>
      <RecipeForm groupId={groupId} />
    </main>
  );
}
