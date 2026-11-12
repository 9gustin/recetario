import { CookShell } from "@/components/cooking/cook-shell";

/** Modo cocinar: pantalla completa, sin barras de navegación y siempre en el tema "noche". */
export default function CookLayout({ children }: { children: React.ReactNode }) {
  return <CookShell>{children}</CookShell>;
}
