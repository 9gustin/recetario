import Link from "next/link";
import type { RecipeListItem } from "@/lib/recipes/queries";

/** Tarjeta de la grilla: foto (o bloque --hero con emoji), título y tiempo. */
export function RecipeCard({ recipe, groupId }: { recipe: RecipeListItem; groupId: string }) {
  return (
    <Link
      href={`/g/${groupId}/recetas/${recipe.id}`}
      className="flex min-h-[216px] flex-col overflow-hidden rounded-[20px] border border-border bg-surface text-foreground"
    >
      <div className="flex h-[120px] flex-none items-center justify-center overflow-hidden bg-hero text-3xl">
        {recipe.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={recipe.image_url} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <span aria-hidden="true">🍽️</span>
        )}
      </div>
      <div className="flex flex-col gap-1 px-3 py-2.5">
        <h3 className="line-clamp-2 text-[15px] leading-tight font-semibold">{recipe.title}</h3>
        <p className="text-xs text-muted">
          {recipe.total_minutes ? `${recipe.total_minutes} min` : "Sin tiempo"}
        </p>
      </div>
    </Link>
  );
}
