"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PillButton } from "@/components/shared/pill-button";
import { savePublishedRecipe } from "@/lib/public/actions";

export type GroupOption = { id: string; name: string; emoji: string | null };

/** "Guardar en mi recetario": sin sesión lleva a entrar; con sesión elige el grupo y copia la receta. */
export function SaveRecipe({
  recipeId,
  slug,
  groups,
}: {
  recipeId: string;
  slug: string;
  groups: GroupOption[] | null;
}) {
  const router = useRouter();
  const [groupId, setGroupId] = useState(
    groups?.find((g) => !g.emoji?.includes("📚"))?.id ?? groups?.[0]?.id ?? "",
  );
  const [pending, start] = useTransition();

  if (!groups)
    return (
      <PillButton asChild fullWidth>
        <Link href={`/login?next=${encodeURIComponent(`/receta/${slug}`)}`}>
          Entrá para guardarla en tu recetario
        </Link>
      </PillButton>
    );

  return (
    <div className="flex flex-col gap-2">
      {groups.length > 1 ? (
        <>
          <label htmlFor="save-group" className="text-sm font-medium">
            ¿En qué grupo la guardamos?
          </label>
          <select
            id="save-group"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="min-h-12 rounded-xl border border-border bg-surface px-3 text-[15px]"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.emoji ?? "🏠"} {g.name}
              </option>
            ))}
          </select>
        </>
      ) : null}
      <PillButton
        fullWidth
        disabled={pending || !groupId}
        onClick={() =>
          start(async () => {
            const res = await savePublishedRecipe({ recipeId, groupId });
            if (!res.ok) return void toast.error(res.error);
            toast.success("¡Guardada en tu recetario!");
            router.push(`/g/${res.data.groupId}/recetas/${res.data.recipeId}`);
          })
        }
      >
        Guardar en mi recetario
      </PillButton>
    </div>
  );
}
