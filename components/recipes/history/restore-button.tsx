"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { PillButton } from "@/components/shared/pill-button";
import { restoreRecipeVersion } from "@/lib/recipes/actions";

export function RestoreButton({
  groupId,
  recipeId,
  version,
}: {
  groupId: string;
  recipeId: string;
  version: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <PillButton variant="outline" size="md" onClick={() => setConfirming(true)}>
        <RotateCcw /> Volver a esta versión
      </PillButton>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3">
      <p className="text-sm">
        Se va a crear una versión nueva con el contenido de la versión {version}. No se pierde nada
        del historial.
      </p>
      <div className="flex gap-2">
        <PillButton
          size="md"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await restoreRecipeVersion({ recipeId, version });
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              toast.success(`Restauraste la versión ${version}`);
              router.push(`/g/${groupId}/recetas/${recipeId}`);
              router.refresh();
            })
          }
        >
          {pending ? "Restaurando…" : "Sí, volver"}
        </PillButton>
        <PillButton
          variant="outline"
          size="md"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Cancelar
        </PillButton>
      </div>
    </div>
  );
}
