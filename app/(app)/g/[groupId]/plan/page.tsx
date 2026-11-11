import { Calendar } from "lucide-react";
import { EmptyState } from "@/components/shell/empty-state";

export const metadata = { title: "Plan" };

export default function Page() {
  return (
    <EmptyState
      icon={Calendar}
      title="Todavía no hay plan"
      description="Armá la semana a mano o con ayuda de la IA."
    />
  );
}
