import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RecipeGridCard } from "@/components/public/recipe-grid-card";
import { getPublicCollection } from "@/lib/public/queries";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const c = await getPublicCollection(slug);
  if (!c) return { title: "Colección no disponible", robots: { index: false } };
  return {
    title: c.title,
    description: c.description ?? `Colección de ${c.recipes.length} recetas`,
    alternates: { canonical: `/coleccion/${slug}` },
  };
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  const c = await getPublicCollection(slug);
  if (!c) notFound();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 py-6">
      <h1 className="font-display text-[32px] leading-[1.05] font-normal">{c.title}</h1>
      {c.description ? <p className="text-[15px] text-muted">{c.description}</p> : null}
      <ul
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        aria-label="Recetas de la colección"
      >
        {c.recipes.map((r) => (
          <RecipeGridCard key={r.slug} recipe={r} />
        ))}
      </ul>
    </div>
  );
}
