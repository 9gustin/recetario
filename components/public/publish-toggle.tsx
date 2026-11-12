"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Globe } from "lucide-react";
import { toast } from "sonner";
import { PillButton } from "@/components/shared/pill-button";
import { setRecipePublic } from "@/lib/public/manage";

/** Hacer pública una receta: queda en /explorar y con un link para compartir sin sesión. */
export function PublishToggle({
  recipeId,
  groupId,
  initialSlug,
  confirmed,
}: {
  recipeId: string;
  groupId: string;
  initialSlug: string | null;
  confirmed: boolean;
}) {
  const [slug, setSlug] = useState(initialSlug);
  const [pending, start] = useTransition();

  function toggle() {
    start(async () => {
      const res = await setRecipePublic({ recipeId, groupId, isPublic: !slug });
      if (!res.ok) return void toast.error(res.error);
      setSlug(res.data.slug);
      toast.success(res.data.slug ? "Receta pública." : "Receta privada otra vez.");
    });
  }

  return (
    <section className="flex flex-col gap-2 rounded-2xl bg-surface p-4" aria-labelledby="publica">
      <h2 id="publica" className="flex items-center gap-2 font-display text-xl font-normal">
        <Globe className="size-5" aria-hidden="true" /> Receta pública
      </h2>
      <p className="text-sm text-muted">
        {slug
          ? "Cualquiera con el link (o buscando en Explorar) la puede ver sin entrar, y guardarla en su recetario."
          : "Compartila con todos: aparece en Explorar y tiene su propio link. Podés volver a hacerla privada cuando quieras."}
      </p>
      {slug ? (
        <Link href={`/receta/${slug}`} className="min-h-11 text-sm font-semibold underline">
          Ver página pública
        </Link>
      ) : null}
      <PillButton
        variant={slug ? "outline" : "soft"}
        size="md"
        disabled={pending || (!slug && !confirmed)}
        onClick={toggle}
      >
        {slug ? "Volver a hacerla privada" : "Hacer pública"}
      </PillButton>
    </section>
  );
}
