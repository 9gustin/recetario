import Link from "next/link";
import { Clock } from "lucide-react";
import type { PublicCard } from "@/lib/public/queries";

/** Tarjeta de receta pública (búsqueda, colecciones). */
export function RecipeGridCard({
  recipe,
}: {
  recipe: Pick<PublicCard, "slug" | "title" | "image_url" | "total_minutes" | "tags"> & {
    is_catalog?: boolean;
  };
}) {
  return (
    <li>
      <Link
        href={`/receta/${recipe.slug}`}
        className="flex h-full flex-col overflow-hidden rounded-2xl bg-surface"
      >
        <span
          className="flex aspect-[4/3] items-center justify-center bg-hero text-4xl"
          aria-hidden="true"
        >
          {recipe.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={recipe.image_url} alt="" className="size-full object-cover" loading="lazy" />
          ) : (
            "🍽️"
          )}
        </span>
        <span className="flex flex-1 flex-col gap-1 p-3">
          <h2 className="line-clamp-2 text-[15px] leading-tight font-semibold">{recipe.title}</h2>
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
            {recipe.total_minutes ? (
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden="true" /> {recipe.total_minutes} min
              </span>
            ) : null}
            {recipe.is_catalog ? <span>Catálogo</span> : <span>Comunidad</span>}
          </span>
        </span>
      </Link>
    </li>
  );
}
