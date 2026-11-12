"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { savePublicRecipe } from "@/lib/recipes/public-actions";

type Group = { id: string; name: string; emoji: string | null; is_personal: boolean };

/** Elegir en qué grupo guardar la receta que llegó por link. */
export function SavePublicRecipe({
  token,
  title,
  groups,
}: {
  token: string;
  title: string;
  groups: Group[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function save(group: Group) {
    start(async () => {
      const res = await savePublicRecipe({ token, targetGroupId: group.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Guardada en ${group.name}`);
      router.push(`/g/${res.data.groupId}/recetas/${res.data.recipeId}`);
    });
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-5 pt-10">
      <div>
        <h1 className="font-display text-[32px] leading-[1.05] font-normal">
          Guardar en tu recetario
        </h1>
        <p className="mt-2 text-sm text-muted">
          Elegí en qué grupo querés guardar <strong className="text-foreground">{title}</strong>.
          Queda una copia tuya que podés adaptar.
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {groups.map((g) => (
          <li key={g.id}>
            <button
              type="button"
              disabled={pending}
              onClick={() => save(g)}
              className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border bg-surface px-4 text-left disabled:opacity-60"
            >
              <span className="text-xl" aria-hidden="true">
                {g.emoji ?? "🍽️"}
              </span>
              <span className="text-[15px] font-semibold">{g.name}</span>
              {g.is_personal ? <span className="ml-auto text-xs text-muted">Personal</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
