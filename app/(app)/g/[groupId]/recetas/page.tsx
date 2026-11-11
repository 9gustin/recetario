import { Book } from "lucide-react";
import { EmptyState } from "@/components/shell/empty-state";

export const metadata = { title: "Recetas" };

export default function Page() {
  return (
    <EmptyState
      icon={Book}
      title="Todavía no hay recetas"
      description="Sumá tu primera receta escribiéndola, pegando un link o con una foto."
    />
  );
}
