import { User } from "lucide-react";
import { EmptyState } from "@/components/shell/empty-state";

export const metadata = { title: "Perfil" };

export default function Page() {
  return (
    <EmptyState
      icon={User}
      title="Tu perfil"
      description="Acá vas a poder cargar tu alimentación y elegir el tema."
    />
  );
}
