import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublishedRecipeBody } from "@/components/public/published-recipe";
import { SaveRecipe, type GroupOption } from "@/components/public/save-recipe";
import { BRAND } from "@/lib/brand";
import { getMyGroups } from "@/lib/groups/queries";
import { getPublishedRecipe } from "@/lib/public/queries";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const recipe = await getPublishedRecipe(slug);
  if (!recipe) return { title: "Receta no disponible", robots: { index: false } };
  const description = recipe.description?.slice(0, 160) ?? `Receta en ${BRAND.name}`;
  return {
    title: recipe.title,
    description,
    alternates: { canonical: `/receta/${slug}` },
    openGraph: {
      title: recipe.title,
      description,
      type: "article",
      siteName: BRAND.name,
      images: recipe.image_url ? [recipe.image_url] : undefined,
    },
    twitter: {
      card: recipe.image_url ? "summary_large_image" : "summary",
      title: recipe.title,
      description,
    },
  };
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  const recipe = await getPublishedRecipe(slug);
  if (!recipe) notFound();

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const groups: GroupOption[] | null = userId
    ? (await getMyGroups(userId)).map((g) => ({ id: g.id, name: g.name, emoji: g.emoji }))
    : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipe.title,
    description: recipe.description ?? undefined,
    image: recipe.image_url ? [recipe.image_url] : undefined,
    recipeYield: `${recipe.servings} porciones`,
    totalTime: recipe.total_minutes ? `PT${recipe.total_minutes}M` : undefined,
    recipeIngredient: recipe.ingredients.map((i) => i.raw_text),
    recipeInstructions: recipe.steps.map((s) => ({ "@type": "HowToStep", text: s.instruction })),
    keywords: recipe.tags.join(", "),
  };

  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <header className="flex flex-col gap-2">
        {recipe.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.image_url}
            alt=""
            className="aspect-[4/3] w-full rounded-2xl object-cover"
          />
        ) : null}
        <h1 className="font-display text-[34px] leading-[1.05] font-normal text-balance">
          {recipe.title}
        </h1>
      </header>
      <SaveRecipe recipeId={recipe.id} slug={slug} groups={groups} />
      <PublishedRecipeBody recipe={recipe} />
    </article>
  );
}
