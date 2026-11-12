import type { Metadata } from "next";
import { CookingStories } from "@/components/cooking/cooking-stories";
import { UnavailableRecipe } from "@/components/recipes/unavailable-recipe";
import { getPublicRecipe, toCookingRecipe } from "@/lib/recipes/public";

export const metadata: Metadata = { title: "Cocinar", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const recipe = await getPublicRecipe(token);
  if (!recipe) return <UnavailableRecipe />;
  return (
    <CookingStories
      groupId=""
      recipe={toCookingRecipe(token, recipe)}
      persist={false}
      exitHref={`/r/${token}`}
      saveHref={`/r/${token}/guardar`}
    />
  );
}
