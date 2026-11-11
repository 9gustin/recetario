import { ShoppingBag } from "lucide-react";
import { EmptyState } from "@/components/shell/empty-state";

export const metadata = { title: "Compras" };

export default function Page() {
  return (
    <EmptyState
      icon={ShoppingBag}
      title="Tu lista está vacía"
      description="La lista de compras se arma sola desde el plan de la semana."
    />
  );
}
