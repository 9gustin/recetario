"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PillButton } from "@/components/shared/pill-button";
import { addToCollection, removeFromCollection, setCollectionPublic } from "@/lib/public/manage";

type Item = { id: string; title: string };

/** Armar una colección (agregar/quitar recetas) y hacerla pública con su link. */
export function CollectionManager({
  groupId,
  collection,
  items: initialItems,
  available: initialAvailable,
}: {
  groupId: string;
  collection: { id: string; title: string; description: string | null; slug: string | null };
  items: Item[];
  available: Item[];
}) {
  const [items, setItems] = useState(initialItems);
  const [available, setAvailable] = useState(initialAvailable);
  const [slug, setSlug] = useState(collection.slug);
  const [pick, setPick] = useState(initialAvailable[0]?.id ?? "");
  const [pending, start] = useTransition();

  function add() {
    const recipe = available.find((r) => r.id === pick);
    if (!recipe) return;
    start(async () => {
      const res = await addToCollection({
        collectionId: collection.id,
        recipeId: recipe.id,
        groupId,
      });
      if (!res.ok) return void toast.error(res.error);
      setItems((p) => [...p, recipe]);
      const rest = available.filter((r) => r.id !== recipe.id);
      setAvailable(rest);
      setPick(rest[0]?.id ?? "");
    });
  }
  function remove(item: Item) {
    start(async () => {
      const res = await removeFromCollection({
        collectionId: collection.id,
        recipeId: item.id,
        groupId,
      });
      if (!res.ok) return void toast.error(res.error);
      setItems((p) => p.filter((i) => i.id !== item.id));
      setAvailable((p) => [...p, item]);
    });
  }
  function toggle() {
    start(async () => {
      const res = await setCollectionPublic({
        collectionId: collection.id,
        groupId,
        isPublic: !slug,
      });
      if (!res.ok) return void toast.error(res.error);
      setSlug(res.data.slug);
      toast.success(
        res.data.slug ? "Colección pública (y sus recetas también)." : "Colección privada.",
      );
    });
  }

  return (
    <div className="flex flex-col gap-4 px-5 pt-2 pb-8">
      <h2 className="font-display text-[28px] leading-[1.05] font-normal">{collection.title}</h2>

      <section className="flex flex-col gap-2 rounded-2xl bg-surface p-4" aria-label="Publicar">
        <p className="text-sm text-muted">
          {slug
            ? "Es pública: cualquiera con el link la ve sin entrar."
            : "Es privada. Al hacerla pública, sus recetas también se publican."}
        </p>
        {slug ? (
          <Link href={`/coleccion/${slug}`} className="min-h-11 text-sm font-semibold underline">
            Ver página pública
          </Link>
        ) : null}
        <PillButton
          size="md"
          variant={slug ? "outline" : "soft"}
          disabled={pending || (!slug && items.length === 0)}
          onClick={toggle}
        >
          {slug ? "Volver a hacerla privada" : "Hacer pública"}
        </PillButton>
      </section>

      <ul className="flex flex-col gap-1.5" aria-label="Recetas de la colección">
        {items.map((i) => (
          <li
            key={i.id}
            className="flex items-center justify-between rounded-2xl bg-surface px-4 py-2.5"
          >
            <Link href={`/g/${groupId}/recetas/${i.id}`} className="text-[15px] font-semibold">
              {i.title}
            </Link>
            <button
              type="button"
              aria-label={`Quitar ${i.title}`}
              onClick={() => remove(i)}
              className="flex size-11 items-center justify-center rounded-full text-muted"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
        {items.length === 0 ? (
          <li className="text-sm text-muted">Todavía no hay recetas en esta colección.</li>
        ) : null}
      </ul>

      {available.length > 0 ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="add-recipe" className="text-sm font-medium">
            Agregar una receta
          </label>
          <div className="flex gap-2">
            <select
              id="add-recipe"
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              className="min-h-12 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 text-[15px]"
            >
              {available.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
            <PillButton size="md" disabled={pending} onClick={add}>
              Agregar
            </PillButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
