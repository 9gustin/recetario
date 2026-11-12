"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { searchCatalogCards, type CatalogCard } from "@/lib/public/catalog-actions";
import { savePublishedRecipe } from "@/lib/public/actions";

/** "Del catálogo": después de tus recetas, ideas públicas para guardar (aptas para todo el grupo). */
export function CatalogSection({ groupId, q }: { groupId: string; q: string }) {
  const router = useRouter();
  const [cards, setCards] = useState<CatalogCard[]>([]);
  const [pending, start] = useTransition();

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      void searchCatalogCards({ groupId, q: q || undefined }).then((res) => {
        if (!cancelled && res.ok) setCards(res.data);
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [groupId, q]);

  if (cards.length === 0) return null;

  return (
    <section className="mt-6 flex flex-col gap-2" aria-labelledby="del-catalogo">
      <h2 id="del-catalogo" className="font-display text-xl font-normal">
        Del catálogo
      </h2>
      <p className="text-sm text-muted">
        Recetas rápidas para probar cosas nuevas. Guardalas y editalas a tu gusto.
      </p>
      <ul className="flex flex-col gap-2" aria-label="Recetas del catálogo">
        {cards.map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded-2xl bg-surface px-3 py-2.5">
            <Link href={`/receta/${c.slug}`} className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold">{c.title}</span>
              <span className="text-xs text-muted">
                {c.total_minutes ? `${c.total_minutes} min` : "Catálogo"}
              </span>
            </Link>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await savePublishedRecipe({ recipeId: c.id, groupId });
                  if (!res.ok) return void toast.error(res.error);
                  toast.success("Guardada en tu recetario.");
                  router.push(`/g/${groupId}/recetas/${res.data.recipeId}`);
                })
              }
              className="min-h-11 rounded-full border border-border px-3.5 text-[13px] font-semibold"
            >
              Guardar
            </button>
          </li>
        ))}
      </ul>
      <Link href="/explorar" className="min-h-11 py-2 text-sm font-semibold underline">
        Explorar todo el catálogo
      </Link>
    </section>
  );
}
