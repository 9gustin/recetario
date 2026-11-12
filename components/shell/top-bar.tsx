"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { NAV_ITEMS } from "./nav-items";
import { GroupSwitcher } from "@/components/groups/group-switcher";
import type { GroupSummary } from "@/lib/groups/queries";

function sectionTitle(pathname: string): string {
  const segment = pathname.split("/").filter(Boolean);
  if (segment[0] === "grupos") return "Grupos";
  const key = segment[0] === "g" ? segment[2] : segment[0];
  return NAV_ITEMS.find((item) => item.key === key)?.label ?? "Recetario";
}

/** Barra superior: título de la sección y selector de grupo. */
export function TopBar({
  groups,
  defaultGroupId,
}: {
  groups: GroupSummary[];
  defaultGroupId?: string;
}) {
  const pathname = usePathname();
  const title = sectionTitle(pathname);
  const groupId = pathname.match(/^\/g\/([^/]+)/)?.[1] ?? defaultGroupId;
  return (
    <header className="sticky top-0 z-10 flex min-h-14 items-center justify-between gap-3 bg-background px-5 pt-[env(safe-area-inset-top)]">
      <h1 className="font-display text-[28px] leading-none font-normal">{title}</h1>
      <div className="flex items-center gap-2">
        {groupId ? (
          <Link
            href={`/g/${groupId}/preguntar`}
            aria-label="Preguntale al asistente"
            className="flex size-11 items-center justify-center rounded-full border border-border bg-surface"
          >
            <MessageCircle className="size-5" aria-hidden="true" />
          </Link>
        ) : null}
        <GroupSwitcher groups={groups} defaultGroupId={defaultGroupId} />
      </div>
    </header>
  );
}
