import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/shell/empty-state";
import { PillButton } from "@/components/shared/pill-button";

export const metadata = { title: "No encontrado" };

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center">
      <EmptyState
        icon={SearchX}
        title="No encontramos lo que buscabas"
        description="El link puede estar mal o ya no existir."
      />
      <PillButton asChild className="mb-16">
        <Link href="/">Volver al inicio</Link>
      </PillButton>
    </div>
  );
}
