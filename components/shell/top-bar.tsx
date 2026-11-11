"use client";

import { ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";

function sectionTitle(pathname: string): string {
  const segment = pathname.split("/").filter(Boolean);
  const key = segment[0] === "g" ? segment[2] : segment[0];
  return NAV_ITEMS.find((item) => item.key === key)?.label ?? "Recetario";
}

/** Barra superior: título de la sección y selector de grupo (placeholder hasta T1.4). */
export function TopBar() {
  const title = sectionTitle(usePathname());
  return (
    <header className="sticky top-0 z-10 flex min-h-14 items-center justify-between gap-3 bg-background px-5 pt-[env(safe-area-inset-top)]">
      <h1 className="font-display text-[28px] leading-none font-normal">{title}</h1>
      <button
        type="button"
        disabled
        aria-label="Cambiar de grupo"
        className="flex min-h-11 items-center gap-1.5 rounded-full border border-border px-3.5 text-sm font-semibold"
      >
        Casa
        <ChevronDown className="size-4 text-muted" aria-hidden="true" />
      </button>
    </header>
  );
}
