import Link from "next/link";
import { MessageSquare, Sun } from "lucide-react";
import { EmptyState } from "@/components/shell/empty-state";
import { PillButton } from "@/components/shared/pill-button";

export const metadata = { title: "Hoy" };

export default async function Page({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  return (
    <>
      <div className="flex justify-end px-5">
        <PillButton asChild variant="soft" size="md">
          <Link href={`/g/${groupId}/preguntar`}>
            <MessageSquare /> Preguntar
          </Link>
        </PillButton>
      </div>
      <EmptyState
        icon={Sun}
        title="Todavía no hay nada para hoy"
        description="Cuando planees la semana, acá vas a ver qué toca cocinar."
      />
    </>
  );
}
