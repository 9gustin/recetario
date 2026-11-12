"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Inbox } from "lucide-react";
import { toast } from "sonner";
import { PillButton } from "@/components/shared/pill-button";
import { EmptyState } from "@/components/shell/empty-state";
import { acceptInboxRecipe, dismissInboxItem, markAllRead } from "@/lib/inbox/actions";

export type InboxEntry = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
};
export type InboxGroup = { id: string; name: string; emoji: string | null; is_personal: boolean };

const dateFormat = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

type CardProps = {
  entry: InboxEntry;
  groups: InboxGroup[];
  busy: boolean;
  onAccept: (entry: InboxEntry, group: InboxGroup) => void;
  onDismiss: (entry: InboxEntry) => void;
};

/** "Agus te compartió Pollo al limón" con foto y botones. */
function RecipeSharedCard({ entry, groups, busy, onAccept, onDismiss }: CardProps) {
  const [choosing, setChoosing] = useState(false);
  const title = str(entry.payload.title) ?? "una receta";
  const from = str(entry.payload.from_name) ?? "Alguien";
  const image = str(entry.payload.image_url);

  return (
    <li className="flex flex-col gap-3 rounded-[20px] border border-border bg-surface p-4">
      <div className="flex gap-3">
        <div className="flex size-16 flex-none items-center justify-center overflow-hidden rounded-2xl bg-hero text-2xl">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="size-full object-cover" loading="lazy" />
          ) : (
            <span aria-hidden="true">🍽️</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[15px] leading-snug">
            <strong>{from}</strong> te compartió{" "}
            <strong className="font-display text-[17px] font-normal">{title}</strong>
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {dateFormat.format(new Date(entry.created_at))}
          </p>
        </div>
      </div>

      {choosing ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">¿En qué grupo la guardamos?</p>
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              disabled={busy}
              onClick={() => onAccept(entry, g)}
              className="flex min-h-12 items-center gap-3 rounded-2xl border border-border bg-background px-4 text-left disabled:opacity-60"
            >
              <span aria-hidden="true">{g.emoji ?? "🍽️"}</span>
              <span className="text-[15px] font-semibold">{g.name}</span>
            </button>
          ))}
          <PillButton variant="outline" size="md" onClick={() => setChoosing(false)}>
            Cancelar
          </PillButton>
        </div>
      ) : (
        <div className="flex gap-2">
          <PillButton
            size="md"
            className="flex-1"
            disabled={busy}
            onClick={() => setChoosing(true)}
          >
            Guardar
          </PillButton>
          <PillButton
            variant="outline"
            size="md"
            className="flex-1"
            disabled={busy}
            onClick={() => onDismiss(entry)}
          >
            Descartar
          </PillButton>
        </div>
      )}
    </li>
  );
}

/** Avisos del grupo: plan aprobado, alguien se sumó, compra terminada. */
function GenericCard({ entry, busy, onDismiss }: CardProps) {
  const url = str(entry.payload.url);
  return (
    <li className="flex flex-col gap-3 rounded-[20px] border border-border bg-surface p-4">
      <p className="text-[15px]">{str(entry.payload.message) ?? "Tenés una novedad."}</p>
      <p className="text-xs text-muted">{dateFormat.format(new Date(entry.created_at))}</p>
      <div className="flex gap-2">
        {url ? (
          <PillButton asChild size="md" className="flex-1">
            <Link href={url}>Ver</Link>
          </PillButton>
        ) : null}
        <PillButton
          variant="outline"
          size="md"
          className="flex-1"
          disabled={busy}
          onClick={() => onDismiss(entry)}
        >
          Descartar
        </PillButton>
      </div>
    </li>
  );
}

const CARDS: Record<string, (props: CardProps) => React.ReactNode> = {
  recipe_shared: RecipeSharedCard,
};

export function InboxList({ entries, groups }: { entries: InboxEntry[]; groups: InboxGroup[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function accept(entry: InboxEntry, group: InboxGroup) {
    start(async () => {
      const res = await acceptInboxRecipe({ inboxId: entry.id, targetGroupId: group.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Guardada en ${group.name}`, {
        action: {
          label: "Ver",
          onClick: () => router.push(`/g/${res.data.groupId}/recetas/${res.data.recipeId}`),
        },
      });
      router.refresh();
    });
  }

  function dismiss(entry: InboxEntry) {
    start(async () => {
      const res = await dismissInboxItem({ inboxId: entry.id });
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No tenés novedades"
        description="Cuando alguien te mande una receta, aparece acá."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <PillButton
        variant="outline"
        size="md"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await markAllRead();
            router.refresh();
          })
        }
      >
        Marcar todo como leído
      </PillButton>
      <ul className="flex flex-col gap-3">
        {entries.map((entry) => {
          const Card = CARDS[entry.kind] ?? GenericCard;
          return (
            <Card
              key={entry.id}
              entry={entry}
              groups={groups}
              busy={pending}
              onAccept={accept}
              onDismiss={dismiss}
            />
          );
        })}
      </ul>
    </div>
  );
}
