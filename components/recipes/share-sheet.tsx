"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Copy, Link2, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { PillButton } from "@/components/shared/pill-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  copyRecipeToGroup,
  createShareLink,
  revokeShareLink,
  sendRecipeToPerson,
} from "@/lib/recipes/share-actions";

export type ShareGroup = { id: string; name: string; emoji: string | null };
export type ShareContactItem = { id: string; name: string; avatar_url: string | null };

type Props = {
  recipeId: string;
  recipeTitle: string;
  currentGroupId: string;
  groups: ShareGroup[];
  contacts: ShareContactItem[];
  initialShareUrl: string | null;
};

type View = "menu" | "link" | "group" | "person";

function Option({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: typeof Link2;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-border bg-surface px-4 text-left"
    >
      <span className="flex size-10 flex-none items-center justify-center rounded-full bg-hero">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="flex flex-col">
        <span className="text-[15px] font-semibold">{title}</span>
        <span className="text-[13px] text-muted">{description}</span>
      </span>
    </button>
  );
}

/** Compartir una receta: por link público, copiándola a otro grupo o mandándola a una persona. */
export function ShareSheet({
  recipeId,
  recipeTitle,
  currentGroupId,
  groups,
  contacts,
  initialShareUrl,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("menu");
  const [shareUrl, setShareUrl] = useState<string | null>(initialShareUrl);
  const [pending, start] = useTransition();
  const [confirmGroup, setConfirmGroup] = useState<ShareGroup | null>(null);

  const otherGroups = groups.filter((g) => g.id !== currentGroupId);

  function close(next: boolean) {
    setOpen(next);
    if (!next) {
      setView("menu");
      setConfirmGroup(null);
    }
  }

  async function copyToClipboard(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("No pudimos copiar el link. Mantené apretado para copiarlo a mano.");
    }
  }

  function sendLink() {
    start(async () => {
      const res = await createShareLink({ recipeId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setShareUrl(res.data.url);
      setView("link");
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({
            title: recipeTitle,
            text: `Te paso esta receta: ${recipeTitle}`,
            url: res.data.url,
          });
        } catch {
          // Cerró el panel de compartir: queda el link a la vista para copiarlo.
        }
      }
    });
  }

  function stopSharing() {
    start(async () => {
      const res = await revokeShareLink({ recipeId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setShareUrl(null);
      setView("menu");
      toast.success("Dejaste de compartir la receta");
    });
  }

  function copyToGroup(group: ShareGroup) {
    start(async () => {
      const res = await copyRecipeToGroup({ recipeId, targetGroupId: group.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Copiada a ${group.name}`, {
        action: {
          label: "Ver",
          onClick: () => router.push(`/g/${res.data.groupId}/recetas/${res.data.recipeId}`),
        },
      });
      close(false);
    });
  }

  function sendToPerson(contact: ShareContactItem) {
    start(async () => {
      const res = await sendRecipeToPerson({ recipeId, userId: contact.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Le llegó a ${contact.name}`);
      close(false);
    });
  }

  return (
    <>
      <PillButton variant="soft" fullWidth onClick={() => setOpen(true)}>
        <Send /> Compartir
      </PillButton>

      <Sheet open={open} onOpenChange={close}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Compartir receta</SheetTitle>
            <SheetDescription>{recipeTitle}</SheetDescription>
          </SheetHeader>

          <div className="flex max-h-[65dvh] flex-col gap-3 overflow-y-auto px-4 pb-6">
            {view !== "menu" ? (
              <button
                type="button"
                onClick={() => {
                  setView("menu");
                  setConfirmGroup(null);
                }}
                className="flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-accent"
              >
                <ChevronLeft className="size-4" aria-hidden="true" /> Volver
              </button>
            ) : null}

            {view === "menu" ? (
              <>
                <Option
                  icon={Link2}
                  title="Mandar link"
                  description="Cualquiera con el link la ve, sin cuenta"
                  onClick={sendLink}
                />
                <Option
                  icon={Users}
                  title="Copiar a otro grupo"
                  description="Queda una copia que podés adaptar"
                  onClick={() => setView("group")}
                />
                <Option
                  icon={Send}
                  title="Mandar a una persona"
                  description="Le llega a su bandeja"
                  onClick={() => setView("person")}
                />
                {pending ? <p className="text-center text-sm text-muted">Un segundo…</p> : null}
              </>
            ) : null}

            {view === "link" && shareUrl ? (
              <div className="flex flex-col gap-3">
                <p
                  className="rounded-2xl bg-surface-2 px-4 py-3 text-sm break-all"
                  data-testid="share-url"
                >
                  {shareUrl}
                </p>
                <PillButton onClick={() => void copyToClipboard(shareUrl)}>
                  <Copy /> Copiar link
                </PillButton>
                {typeof navigator !== "undefined" && typeof navigator.share === "function" ? (
                  <PillButton
                    variant="outline"
                    onClick={() =>
                      void navigator
                        .share({
                          title: recipeTitle,
                          text: `Te paso esta receta: ${recipeTitle}`,
                          url: shareUrl,
                        })
                        .catch(() => {})
                    }
                  >
                    <Send /> Mandar de nuevo
                  </PillButton>
                ) : null}
                <p className="text-center text-[13px] text-muted">
                  Cualquiera con el link la puede ver.
                </p>
                <PillButton variant="outline" size="md" disabled={pending} onClick={stopSharing}>
                  Dejar de compartir
                </PillButton>
              </div>
            ) : null}

            {view === "group" ? (
              otherGroups.length === 0 ? (
                <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4 text-sm">
                  <p>No tenés otros grupos todavía. Creá uno y volvé a copiar la receta.</p>
                  <PillButton asChild size="md">
                    <Link href="/grupos/nuevo">Crear un grupo</Link>
                  </PillButton>
                </div>
              ) : confirmGroup ? (
                <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
                  <p className="text-[15px]">
                    ¿Copiar <strong>{recipeTitle}</strong> a {confirmGroup.emoji}{" "}
                    {confirmGroup.name}?
                  </p>
                  <div className="flex gap-2">
                    <PillButton
                      size="md"
                      disabled={pending}
                      onClick={() => copyToGroup(confirmGroup)}
                    >
                      {pending ? "Copiando…" : "Copiar"}
                    </PillButton>
                    <PillButton variant="outline" size="md" onClick={() => setConfirmGroup(null)}>
                      Cancelar
                    </PillButton>
                  </div>
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {otherGroups.map((g) => (
                    <li key={g.id}>
                      <button
                        type="button"
                        onClick={() => setConfirmGroup(g)}
                        className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border bg-surface px-4 text-left"
                      >
                        <span className="text-xl" aria-hidden="true">
                          {g.emoji ?? "🍽️"}
                        </span>
                        <span className="text-[15px] font-semibold">{g.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : null}

            {view === "person" ? (
              contacts.length === 0 ? (
                <p className="rounded-2xl bg-surface p-4 text-sm">
                  Todavía no compartís grupo con nadie. Invitá a alguien a un grupo para poder
                  mandarle recetas.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {contacts.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => sendToPerson(c)}
                        className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border bg-surface px-4 text-left"
                      >
                        <Avatar>
                          {c.avatar_url ? <AvatarImage src={c.avatar_url} alt="" /> : null}
                          <AvatarFallback>{c.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="text-[15px] font-semibold">{c.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
