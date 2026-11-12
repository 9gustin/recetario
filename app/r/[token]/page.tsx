import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { getPublicRecipe } from "@/lib/recipes/public";
import { PublicRecipeView } from "@/components/recipes/public-recipe";
import { UnavailableRecipe } from "@/components/recipes/unavailable-recipe";

type Params = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { token } = await params;
  const recipe = await getPublicRecipe(token);
  const robots = { index: false, follow: false };
  if (!recipe) return { title: "Receta no disponible", robots };
  const description =
    recipe.description?.slice(0, 160) ||
    `Receta compartida por ${recipe.shared_by.name?.trim() || "alguien"} en ${BRAND.name}`;
  return {
    title: recipe.title,
    description,
    robots,
    openGraph: { title: recipe.title, description, type: "article", siteName: BRAND.name },
    twitter: { card: "summary_large_image", title: recipe.title, description },
  };
}

export default async function Page({ params }: Params) {
  const { token } = await params;
  const recipe = await getPublicRecipe(token);
  if (!recipe) return <UnavailableRecipe />;
  return <PublicRecipeView token={token} recipe={recipe} />;
}
