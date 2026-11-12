"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, MoreVertical, Plus, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRealtimeList } from "@/lib/hooks/use-realtime-list";
import { AISLE_ORDER } from "@/lib/domain/shopping-list";
import { aisleLabel, shareAsText } from "@/lib/domain/shopping-share";
import { addManualItem, archiveList, setItemState } from "@/lib/shopping/actions";
import type { ListItem, ListRow } from "@/lib/shopping/types";
import { cn } from "@/lib/utils";

type Member = { id: string; name: string };

const rank = (a: string) => {
  const i = AISLE_ORDER.indexOf(a);
  return i === -1 ? AISLE_ORDER.length : i;
};

/** Lista de compras: secciones, tachado compartido en vivo, ítems manuales y compartir como texto. */
export function ListView({
  list,
  initialItems,
  members,
}: {
  list: ListRow;
  initialItems: ListItem[];
  members: Member[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showDone, setShowDone] = useState(false);
  const [draft, setDraft] = useState("");
  const [, start] = useTransition();
  useRealtimeList(list.id, setItems);

  const visible = items.filter((i) => !i.no_longer_needed);
  const done = visible.filter((i) => i.state !== "pending").length;
  const sections = useMemo(() => {
    const map = new Map<string, ListItem[]>();
    for (const i of visible) map.set(i.aisle, [...(map.get(i.aisle) ?? []), i]);
    // Pendientes primero; comprados al final de la sección; "ya lo tengo" al final de todo.
    const order = { pending: 0, bought: 1, have_it: 2 } as const;
    return [...map.entries()]
      .sort((a, b) => rank(a[0]) - rank(b[0]))
      .map(([aisle, list]) => ({
        aisle,
        items: [...list].sort((x, y) => order[x.state] - order[y.state] || x.position - y.position),
      }));
  }, [visible]);
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.name ?? "";

  function mark(item: ListItem, state: ListItem["state"]) {
    const previous = item.state;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, state } : i)));
    start(async () => {
      const res = await setItemState({ id: item.id, state });
      if (!res.ok) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, state: previous } : i)));
        return void toast.error(res.error);
      }
      setItems((prev) => prev.map((i) => (i.id === item.id ? res.data : i)));
      if (state !== "pending")
        toast(
          state === "bought"
            ? `${item.display_name}: comprado`
            : `${item.display_name}: ya lo tenés`,
          {
            action: { label: "Deshacer", onClick: () => mark({ ...item, state }, "pending") },
          },
        );
    });
  }

  function add() {
    const name = draft.trim();
    if (!name) return;
    setDraft("");
    start(async () => {
      const res = await addManualItem({ listId: list.id, name });
      if (!res.ok) return void toast.error(res.error);
      setItems((prev) => (prev.some((i) => i.id === res.data.id) ? prev : [...prev, res.data]));
    });
  }

  async function share() {
    const text = shareAsText(list.name, visible);
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success("Lista copiada.");
      }
    } catch {
      // La persona canceló el diálogo de compartir.
    }
  }

  function archive() {
    start(async () => {
      const res = await archiveList({ listId: list.id, groupId: list.group_id });
      if (!res.ok) return void toast.error(res.error);
      router.push(`/g/${list.group_id}/compras`);
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-3 pb-8">
      <header className="flex items-start justify-between gap-2 px-5">
        <div>
          <h2 className="font-display text-[28px] leading-[1.05] font-normal">{list.name}</h2>
          <p className="text-sm text-muted" aria-live="polite">
            {done}/{visible.length} listos
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Más opciones de la lista"
              className="flex size-11 items-center justify-center rounded-full"
            >
              <MoreVertical className="size-5" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => void share()}>Compartir como texto</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setShowDone((v) => !v)}>
              {showDone ? "Ocultar comprados" : "Ver comprados"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={archive}>Archivar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <form
        className="mx-5 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label htmlFor="add-item" className="sr-only">
          Agregar algo a la lista
        </label>
        <input
          id="add-item"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Agregar algo…"
          className="min-h-12 min-w-0 flex-1 rounded-full border border-border bg-surface px-4 text-[15px] outline-none"
        />
        <button
          type="submit"
          aria-label="Agregar"
          className="flex size-12 flex-none items-center justify-center rounded-full bg-accent text-accent-foreground"
        >
          <Plus className="size-5" />
        </button>
      </form>

      {sections.map(({ aisle, items: list }) => {
        const shown = showDone ? list : list.filter((i) => i.state === "pending");
        const isCollapsed = collapsed.has(aisle);
        const pending = list.filter((i) => i.state === "pending").length;
        if (shown.length === 0 && !showDone) return null;
        return (
          <section key={aisle} aria-label={aisleLabel(aisle)} className="px-4">
            <button
              type="button"
              aria-expanded={!isCollapsed}
              onClick={() =>
                setCollapsed((prev) => {
                  const next = new Set(prev);
                  if (next.has(aisle)) next.delete(aisle);
                  else next.add(aisle);
                  return next;
                })
              }
              className="flex min-h-11 w-full items-center justify-between px-1 text-xs font-bold tracking-wide text-muted uppercase"
            >
              <span>
                {aisleLabel(aisle)} · {pending}
              </span>
              <ChevronDown
                className={cn("size-4 transition-transform", isCollapsed && "-rotate-90")}
                aria-hidden="true"
              />
            </button>
            {isCollapsed ? null : (
              <ul className="flex flex-col gap-1.5">
                {shown.map((item) => (
                  <Row key={item.id} item={item} who={nameOf(item.state_by)} onMark={mark} />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {visible.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-muted">
          La lista está vacía. Agregá algo arriba.
        </p>
      ) : null}
    </div>
  );
}

function Row({
  item,
  who,
  onMark,
}: {
  item: ListItem;
  who: string;
  onMark: (item: ListItem, state: ListItem["state"]) => void;
}) {
  const bought = item.state === "bought";
  const have = item.state === "have_it";
  const detail = item.purchase_hint || (item.is_manual ? "" : "");
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-2xl bg-surface px-3 py-2",
        (bought || have) && "opacity-60",
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={bought}
        aria-label={`Comprado: ${item.display_name}`}
        onClick={() => onMark(item, bought ? "pending" : "bought")}
        className={cn(
          "flex size-11 flex-none items-center justify-center rounded-full border-2",
          bought ? "border-accent bg-accent text-accent-foreground" : "border-border",
        )}
      >
        {bought ? <Check className="size-5" /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[15px] font-medium", (bought || have) && "line-through")}>
          {item.display_name}
        </p>
        <p className="truncate text-xs text-muted">
          {[
            detail,
            item.note,
            item.pantry_staple && item.state === "pending" ? "¿Lo tenés?" : "",
            who && item.state !== "pending" ? `lo marcó ${who}` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {item.shelf_life_warning ? (
          <p className="text-warning text-xs">
            <span aria-hidden="true">⚠️</span> {item.shelf_life_warning}
          </p>
        ) : null}
      </div>
      {have ? (
        <button
          type="button"
          aria-label={`Volver a pendiente: ${item.display_name}`}
          onClick={() => onMark(item, "pending")}
          className="flex size-11 items-center justify-center rounded-full"
        >
          <Undo2 className="size-4" />
        </button>
      ) : item.state === "pending" ? (
        <button
          type="button"
          onClick={() => onMark(item, "have_it")}
          className="min-h-11 rounded-full px-3 text-xs font-semibold text-muted"
        >
          Ya lo tengo
        </button>
      ) : null}
    </li>
  );
}
