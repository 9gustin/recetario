import { PublicHeader } from "@/components/public/public-header";
import { createClient } from "@/lib/supabase/server";

/** Páginas públicas: no piden sesión; el encabezado solo cambia "Entrar" por "Mi recetario". */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <PublicHeader loggedIn={Boolean(data?.claims?.sub)} />
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="px-5 py-6 text-center text-xs text-muted">
        Recetas originales, hechas con ayuda de IA y revisadas por código. Cocinalas bajo tu
        criterio.
      </footer>
    </div>
  );
}
