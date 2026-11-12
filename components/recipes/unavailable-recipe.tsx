import Link from "next/link";
import { LinkIcon } from "lucide-react";
import { EmptyState } from "@/components/shell/empty-state";
import { PillButton } from "@/components/shared/pill-button";

/** Link revocado o inexistente. */
export function UnavailableRecipe() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center">
      <EmptyState
        icon={LinkIcon}
        title="Este link ya no está disponible"
        description="Quien te lo mandó dejó de compartir la receta. Pedile que te mande uno nuevo."
      />
      <PillButton asChild className="mb-16">
        <Link href="/">Ir al inicio</Link>
      </PillButton>
    </div>
  );
}
