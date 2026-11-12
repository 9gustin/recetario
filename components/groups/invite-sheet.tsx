"use client";

import { useState, useTransition } from "react";
import { Copy, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PillButton } from "@/components/shared/pill-button";
import { createInvite, revokeInvite } from "@/lib/groups/invites";

type Invite = { id: string; token: string; expires_at: string | null };

function expiresLabel(expiresAt: string | null) {
  if (!expiresAt) return "No vence";
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return "Vencido";
  if (days === 1) return "Vence mañana";
  return `Vence en ${days} días`;
}

export function InviteSheet({
  groupId,
  groupName,
  initialInvites,
}: {
  groupId: string;
  groupName: string;
  initialInvites: Invite[];
}) {
  const [open, setOpen] = useState(false);
  const [invites, setInvites] = useState<Invite[]>(initialInvites);
  const [isPending, startTransition] = useTransition();

  function link(token: string) {
    return `${window.location.origin}/join/${token}`;
  }

  function generate() {
    startTransition(async () => {
      const res = await createInvite({ groupId });
      if (res.ok) {
        setInvites((prev) => [res.invite, ...prev]);
        toast.success("Link generado");
      } else {
        toast.error(res.error);
      }
    });
  }

  function revoke(id: string) {
    startTransition(async () => {
      const res = await revokeInvite({ groupId, inviteId: id });
      if (res.ok) setInvites((prev) => prev.filter((i) => i.id !== id));
      else toast.error(res.error);
    });
  }

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(link(token));
      toast.success("Link copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  async function share(token: string) {
    const text = `Sumate a ${groupName} en Recetario: ${link(token)}`;
    if (typeof navigator.share === "function") {
      await navigator.share({ text });
    } else {
      await copy(token);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <PillButton type="button" variant="outline" fullWidth>
          Invitar
        </PillButton>
      </SheetTrigger>

      <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-6">
        <SheetHeader className="px-0">
          <SheetTitle>Invitar a {groupName}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-3">
          <PillButton type="button" onClick={generate} disabled={isPending}>
            Generar link
          </PillButton>

          {invites.length === 0 ? (
            <p className="text-sm text-muted">Todavía no generaste ningún link.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center gap-2 rounded-2xl bg-surface px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold">Link de invitación</p>
                    <p className="truncate text-[13px] text-muted">
                      {expiresLabel(invite.expires_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => share(invite.token)}
                    aria-label="Compartir"
                    className="flex size-10 flex-none items-center justify-center rounded-full bg-surface-2"
                  >
                    <Share2 className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => copy(invite.token)}
                    aria-label="Copiar"
                    className="flex size-10 flex-none items-center justify-center rounded-full bg-surface-2"
                  >
                    <Copy className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => revoke(invite.id)}
                    aria-label="Revocar"
                    className="flex size-10 flex-none items-center justify-center rounded-full bg-surface-2 text-danger-soft"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
