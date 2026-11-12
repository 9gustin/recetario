import Link from "next/link";
import { BRAND } from "@/lib/brand";

/** Encabezado simple de las páginas públicas: marca, explorar y entrar. */
export function PublicHeader({ loggedIn }: { loggedIn: boolean }) {
  return (
    <header className="sticky top-0 z-10 flex min-h-14 items-center justify-between gap-3 border-b border-border bg-background px-5 pt-[env(safe-area-inset-top)]">
      <Link href="/explorar" className="font-display text-[22px] leading-none">
        {BRAND.name}
      </Link>
      <nav aria-label="Público" className="flex items-center gap-2 text-sm font-semibold">
        <Link href="/explorar" className="flex min-h-11 items-center px-2">
          Explorar
        </Link>
        <Link
          href={loggedIn ? "/" : "/login"}
          className="flex min-h-11 items-center rounded-full bg-accent px-4 text-accent-foreground"
        >
          {loggedIn ? "Mi recetario" : "Entrar"}
        </Link>
      </nav>
    </header>
  );
}
