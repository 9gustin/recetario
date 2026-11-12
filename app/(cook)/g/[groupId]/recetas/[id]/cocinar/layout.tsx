import { DayPartProvider } from "@/components/theme/day-part-provider";

/** Modo cocinar: pantalla completa, sin barras de navegación y siempre en el tema "noche". */
export default function CookLayout({ children }: { children: React.ReactNode }) {
  return (
    <DayPartProvider force="noche">
      <div
        data-daypart="noche"
        className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-background text-foreground"
      >
        {children}
      </div>
    </DayPartProvider>
  );
}
