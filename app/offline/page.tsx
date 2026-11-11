import { WifiOff } from "lucide-react";
import { EmptyState } from "@/components/shell/empty-state";

export const metadata = { title: "Sin conexión" };

export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <EmptyState
        icon={WifiOff}
        title="Estás sin conexión"
        description="Revisá tu conexión y volvé a intentar. Las recetas que abriste antes siguen disponibles."
      />
    </div>
  );
}
