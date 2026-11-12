"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Search, SearchX } from "lucide-react";
import { EmptyState } from "@/components/shell/empty-state";
import { searchRecipes } from "@/lib/recipes/actions";
import type { RecipeListItem } from "@/lib/recipes/queries";
import { RECIPES_PAGE_SIZE } from "@/lib/schemas/recipe-search";
import { EMPTY_FILTERS, RecipeFilters, hasActiveFilters, type RecipeFilterState } from "./filters";
import { NewRecipeMenu } from "./new-recipe-menu";
import { RecipeCard } from "./recipe-card";

type Props = { groupId: string; topTags: string[]; total: number };

export function RecipeList({ groupId, topTags, total }: Props) {
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<RecipeFilterState>(EMPTY_FILTERS);
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const requestId = useRef(0);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const buildInput = useCallback(
    (offset: number) => ({
      groupId,
      q: q || undefined,
      favoriteOnly: filters.favoriteOnly || undefined,
      maxMinutes: filters.max30 ? 30 : undefined,
      tag: filters.tag ?? undefined,
      ingredientId: filters.ingredient?.id,
      offset,
      limit: RECIPES_PAGE_SIZE,
    }),
    [groupId, q, filters],
  );

  // Primera página (y cada vez que cambia la búsqueda o un filtro), con debounce al escribir.
  useEffect(() => {
    const id = ++requestId.current;
    const t = setTimeout(
      () => {
        setStatus("loading");
        searchRecipes(buildInput(0)).then((res) => {
          if (id !== requestId.current) return;
          if (!res.ok) return setStatus("error");
          setRecipes(res.data.recipes);
          setHasMore(res.data.hasMore);
          setStatus("ready");
        });
      },
      q ? 250 : 0,
    );
    return () => clearTimeout(t);
  }, [buildInput, q]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const id = requestId.current;
    setLoadingMore(true);
    searchRecipes(buildInput(recipes.length)).then((res) => {
      if (id === requestId.current && res.ok) {
        setRecipes((prev) => [...prev, ...res.data.recipes]);
        setHasMore(res.data.hasMore);
      }
      setLoadingMore(false);
    });
  }, [buildInput, hasMore, loadingMore, recipes.length]);

  // Scroll infinito: al ver el final de la grilla, pide la página siguiente.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const obs = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore(), {
      rootMargin: "300px",
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadMore]);

  const filtering = q.trim() !== "" || hasActiveFilters(filters);

  return (
    <div className="flex flex-col gap-3 pb-24">
      <p className="text-[13px] font-semibold text-muted">
        {total === 1 ? "1 receta" : `${total} recetas`}
      </p>

      <label className="flex min-h-12 items-center gap-2.5 rounded-full border border-border bg-surface px-3.5">
        <Search className="size-5 flex-none text-muted" aria-hidden="true" />
        <span className="sr-only">Buscar recetas</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscá por nombre o ingrediente"
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
        />
      </label>

      <RecipeFilters value={filters} onChange={setFilters} topTags={topTags} />

      {status === "loading" && recipes.length === 0 ? (
        <div className="grid grid-cols-2 gap-3" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[216px] animate-pulse rounded-[20px] bg-surface-2" />
          ))}
        </div>
      ) : status === "error" ? (
        <EmptyState
          icon={SearchX}
          title="No se pudo cargar"
          description="Revisá tu conexión y probá de nuevo."
        />
      ) : recipes.length === 0 ? (
        filtering ? (
          <EmptyState
            icon={SearchX}
            title="No encontramos recetas"
            description="Probá con otra búsqueda o sacá algún filtro."
          />
        ) : (
          <EmptyState
            icon={BookOpen}
            title="Cargá tu primera receta"
            description="Empezá por la que más cocinan."
          />
        )
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {recipes.map((r) => (
            <RecipeCard key={r.id} recipe={r} groupId={groupId} />
          ))}
        </div>
      )}

      {hasMore ? (
        <div ref={sentinel} className="py-4 text-center text-sm text-muted">
          {loadingMore ? "Cargando…" : ""}
        </div>
      ) : null}

      <NewRecipeMenu groupId={groupId} />
    </div>
  );
}
