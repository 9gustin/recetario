"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus, Sparkles, UtensilsCrossed, X } from "lucide-react";
import { toast } from "sonner";
import { AddEntrySheet } from "@/components/plan/add-entry-sheet";
import { PlanChatSheet } from "@/components/plan/plan-chat-sheet";
import { PillButton } from "@/components/shared/pill-button";
import { ListView } from "@/components/shopping/list-view";
import { EmptyState } from "@/components/shell/empty-state";
import {
  addMenuEntry,
  refreshMenuList,
  removeMenuEntry,
  updateMenuEntry,
  type MenuSnapshot,
} from "@/lib/menu/actions";
import type { MenuEntry } from "@/lib/plan/types";
import { cn } from "@/lib/utils";

type Member = { id: string; name: string };

type Props = {
  groupId: string;
  planId: string;
  initialEntries: MenuEntry[];
  initialSnapshot: MenuSnapshot;
  members: Member[];
  /** Tablero por días (opcional) para quien quiere asignar fechas. */
  weekHref: string;
};

/** "Mis comidas": un listado simple de lo que querés cocinar, con las compras debajo. Todo se guarda solo. */
export function MenuView({
  groupId,
  planId,
  initialEntries,
  initialSnapshot,
  members,
  weekHref,
}: Props) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  // Cuando el servidor trae comidas nuevas (por ejemplo, las que agregó la IA), se muestran.
  const [seen, setSeen] = useState(initialEntries);
  if (seen !== initialEntries) {
    setSeen(initialEntries);
    setEntries(initialEntries);
  }
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [version, setVersion] = useState(0);
  const [adding, setAdding] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [pending, start] = useTransition();

  const apply = (s: MenuSnapshot) => {
    setSnapshot(s);
    setVersion((v) => v + 1);
  };
  const total = entries.reduce((n, e) => n + e.quantity, 0);
  const toBuy = snapshot.items.filter((i) => !i.pantry_staple && !i.no_longer_needed).length;

  function pick(choice: { recipeId?: string; freeText?: string }) {
    start(async () => {
      const res = await addMenuEntry({ groupId, ...choice });
      if (!res.ok) return void toast.error(res.error);
      setAdding(false);
      apply(res.data);
      router.refresh();
    });
  }

  function setQuantity(e: MenuEntry, quantity: number) {
    if (quantity < 1 || quantity > 20) return;
    setEntries((prev) => prev.map((x) => (x.id === e.id ? { ...x, quantity } : x)));
    start(async () => {
      const res = await updateMenuEntry({ id: e.id, groupId, quantity });
      if (!res.ok) return void toast.error(res.error);
      apply(res.data);
    });
  }

  function toggleCooked(e: MenuEntry) {
    const cooked = !e.cooked_at;
    setEntries((prev) =>
      prev.map((x) =>
        x.id === e.id ? { ...x, cooked_at: cooked ? new Date().toISOString() : null } : x,
      ),
    );
    start(async () => {
      const res = await updateMenuEntry({ id: e.id, groupId, cooked });
      if (!res.ok) return void toast.error(res.error);
      apply(res.data);
    });
  }

  function remove(e: MenuEntry) {
    setEntries((prev) => prev.filter((x) => x.id !== e.id));
    start(async () => {
      const res = await removeMenuEntry({ id: e.id, groupId });
      if (!res.ok) return void toast.error(res.error);
      apply(res.data);
    });
  }

  async function aiUpdated() {
    const res = await refreshMenuList({ groupId });
    if (res.ok) apply(res.data);
    router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col gap-4 pb-28">
      <header className="flex flex-col gap-1 px-5 pt-1">
        <h2 className="font-display text-[30px] leading-[1.05] font-normal">Mis comidas</h2>
        <p className="text-sm text-muted" role="status">
          {entries.length === 0
            ? "Anotá lo que querés cocinar. Se guarda solo."
            : `${total} ${total === 1 ? "comida" : "comidas"} · ${toBuy} cosas para comprar`}
        </p>
      </header>

      <div className="flex gap-2 px-5">
        <PillButton className="flex-1" size="md" onClick={() => setAdding(true)}>
          <Plus /> Agregar comida
        </PillButton>
        <PillButton variant="outline" size="md" onClick={() => setChatOpen(true)}>
          <Sparkles /> Con IA
        </PillButton>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="Todavía no anotaste comidas"
          description="Tocá “Con IA” y contale por audio qué querés comer, o agregá una receta."
        />
      ) : (
        <ul className="flex flex-col gap-2 px-4" aria-label="Comidas">
          {entries.map((e) => {
            const title = e.recipe?.title ?? e.free_text ?? "Comida";
            const cooked = Boolean(e.cooked_at);
            return (
              <li
                key={e.id}
                className="flex min-h-14 items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2"
              >
                <button
                  type="button"
                  aria-label={
                    cooked ? `Marcar ${title} como pendiente` : `Marcar ${title} como cocinada`
                  }
                  aria-pressed={cooked}
                  onClick={() => toggleCooked(e)}
                  className={cn(
                    "flex size-11 flex-none items-center justify-center rounded-full border",
                    cooked ? "border-success bg-success/15 text-success" : "border-border",
                  )}
                >
                  {cooked ? <Check className="size-5" aria-hidden="true" /> : null}
                </button>
                <span
                  className={cn(
                    "min-w-0 flex-1 text-[15px] font-semibold",
                    cooked && "text-muted line-through",
                  )}
                >
                  {e.recipe_id ? (
                    <Link href={`/g/${groupId}/recetas/${e.recipe_id}`} className="block truncate">
                      {title}
                    </Link>
                  ) : (
                    <span className="block truncate">{title}</span>
                  )}
                </span>
                <span className="flex items-center">
                  <button
                    type="button"
                    aria-label={`Menos ${title}`}
                    disabled={e.quantity <= 1}
                    onClick={() => setQuantity(e, e.quantity - 1)}
                    className="flex size-11 items-center justify-center rounded-full disabled:opacity-30"
                  >
                    <Minus className="size-4" aria-hidden="true" />
                  </button>
                  <span
                    className="w-6 text-center text-sm font-bold"
                    aria-label={`${e.quantity} veces`}
                  >
                    ×{e.quantity}
                  </span>
                  <button
                    type="button"
                    aria-label={`Más ${title}`}
                    onClick={() => setQuantity(e, e.quantity + 1)}
                    className="flex size-11 items-center justify-center rounded-full"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </button>
                </span>
                <button
                  type="button"
                  aria-label={`Quitar ${title}`}
                  onClick={() => remove(e)}
                  className="flex size-11 items-center justify-center rounded-full text-muted"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {entries.length > 0 && snapshot.listId ? (
        <section aria-label="Qué comprar" className="flex flex-col gap-2">
          <h3 className="px-5 font-display text-2xl font-normal">Qué comprar</h3>
          <ListView
            key={`${snapshot.listId}-${version}`}
            list={{
              id: snapshot.listId,
              group_id: groupId,
              name: "Compras",
              status: "active",
              shop_date: null,
            }}
            initialItems={snapshot.items}
            members={members}
          />
        </section>
      ) : null}

      <p className="px-5 text-center text-xs text-muted">
        <Link href={weekHref} className="underline">
          Planificar por días
        </Link>
      </p>

      <PlanChatSheet
        planId={planId}
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onPlanUpdated={() => void aiUpdated()}
        menu
      />
      <AddEntrySheet
        open={adding}
        onOpenChange={setAdding}
        groupId={groupId}
        date=""
        slot="lunch"
        slots={[]}
        looseMeal
        busy={pending}
        onPick={pick}
      />
    </div>
  );
}
