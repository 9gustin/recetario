"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

/** Barra inferior fija: 5 tabs, 76 px de alto, respeta el safe-area de iOS. */
export function BottomNav({
  className,
  defaultGroupId,
  inboxCount = 0,
}: {
  className?: string;
  defaultGroupId?: string;
  /** Ítems sin resolver de la bandeja: se muestran como un globito en la tab Perfil. */
  inboxCount?: number;
}) {
  const pathname = usePathname();
  const params = useParams<{ groupId?: string }>();
  const groupId = params.groupId ?? defaultGroupId;

  return (
    <nav
      aria-label="Principal"
      className={cn(
        "grid h-[calc(76px+env(safe-area-inset-bottom))] grid-cols-5 border-t border-border bg-background pb-[calc(8px+env(safe-area-inset-bottom))]",
        className,
      )}
    >
      {NAV_ITEMS.map(({ key, label, icon: Icon, href }) => {
        const to = href(groupId ?? "");
        const active = pathname === to || pathname.startsWith(`${to}/`);
        return (
          <Link
            key={key}
            href={to}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center justify-center gap-[3px] text-[11px] outline-none focus-visible:bg-surface-2",
              active ? "font-bold text-accent" : "font-medium text-muted",
            )}
          >
            <span className="relative">
              <Icon className="size-[22px]" strokeWidth={2} aria-hidden="true" />
              {key === "perfil" && inboxCount > 0 ? (
                <span
                  role="status"
                  aria-label={`${inboxCount} ${inboxCount === 1 ? "novedad" : "novedades"} en la bandeja`}
                  className="absolute -top-1 -right-2.5 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] leading-4 font-bold text-accent-foreground"
                >
                  {inboxCount > 9 ? "9+" : inboxCount}
                </span>
              ) : null}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
