"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ChevronDown, Plus, Settings } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { GroupSummary } from "@/lib/groups/queries";

function activeGroupId(pathname: string): string | null {
  const match = pathname.match(/^\/g\/([^/]+)/);
  return match?.[1] ?? null;
}

/** Selector de grupo activo en la barra superior: Sheet con la lista de mis grupos. */
export function GroupSwitcher({ groups }: { groups: GroupSummary[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const activeId = activeGroupId(pathname);
  const active = groups.find((g) => g.id === activeId) ?? groups[0];

  function selectGroup(id: string) {
    setOpen(false);
    router.push(`/g/${id}/hoy`);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Cambiar de grupo"
          className="flex min-h-11 items-center gap-1.5 rounded-full border border-border px-3.5 text-sm font-semibold"
        >
          {active?.emoji ? <span aria-hidden="true">{active.emoji}</span> : null}
          <span className="max-w-[120px] truncate">{active?.name ?? "Grupos"}</span>
          <ChevronDown className="size-4 text-muted" aria-hidden="true" />
        </button>
      </SheetTrigger>

      <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-6">
        <SheetHeader className="px-0">
          <SheetTitle>Mis grupos</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-1">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => selectGroup(g.id)}
              className="flex min-h-[52px] items-center gap-3 rounded-2xl px-3 text-left"
            >
              <span className="flex size-9 flex-none items-center justify-center rounded-full bg-surface-2 text-lg">
                {g.emoji ?? "🏠"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{g.name}</span>
                <span className="block text-[13px] text-muted">
                  {g.member_count} {g.member_count === 1 ? "persona" : "personas"}
                </span>
              </span>
              {g.id === activeId ? (
                <Check className="size-5 text-accent" aria-hidden="true" />
              ) : null}
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-col gap-1 border-t border-border pt-3">
          <Link
            href="/grupos/nuevo"
            onClick={() => setOpen(false)}
            className="flex min-h-[48px] items-center gap-3 rounded-2xl px-3 text-[15px] font-semibold"
          >
            <Plus className="size-5 text-muted" aria-hidden="true" />
            Crear grupo
          </Link>
          <Link
            href="/grupos"
            onClick={() => setOpen(false)}
            className="flex min-h-[48px] items-center gap-3 rounded-2xl px-3 text-[15px] font-semibold"
          >
            <Settings className="size-5 text-muted" aria-hidden="true" />
            Administrar grupos
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
