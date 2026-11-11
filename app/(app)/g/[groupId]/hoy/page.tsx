import { Sun } from "lucide-react";
import { EmptyState } from "@/components/shell/empty-state";

export const metadata = { title: "Hoy" };

export default function Page() {
  return (
    <EmptyState
      icon={Sun}
      title="Todavía no hay nada para hoy"
      description="Cuando planees la semana, acá vas a ver qué toca cocinar."
    />
  );
}
