"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  History,
  MoreVertical,
  Plus,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useFinalize } from "@/lib/hooks/use-finalize";
import { useRealtimePlan } from "@/lib/hooks/use-realtime-plan";
import { PillButton } from "@/components/shared/pill-button";
import { EmptyState } from "@/components/shell/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MEAL_SLOTS, slotLabel, type MealSlot } from "@/lib/domain/meal-slots";
import { addDays, dayLabel, formatWeekLabel, weekDays } from "@/lib/domain/week";
import {
  addEntry,
  approvePlan,
  createPlan,
  discardPlan,
  duplicatePlan,
  removeEntry,
  updateEntry,
} from "@/lib/plan/actions";
import { generateListForPlan } from "@/lib/shopping/actions";
import type { PlanHistoryItem } from "@/lib/plan/queries";
import type { PlanEntry, PlanMember, PlanRow } from "@/lib/plan/types";
import { cn } from "@/lib/utils";
import { AddEntrySheet } from "./add-entry-sheet";
import { EditEntrySheet, type Patch } from "./edit-entry-sheet";
import { EntryRow } from "./entry-row";
import { PlanChatSheet } from "./plan-chat-sheet";

type Props = {
  groupId: string;
  weekStart: string;
  today: string;
  plan: PlanRow | null;
  initialEntries: PlanEntry[];
  members: PlanMember[];
  currentUserId: string;
  mealSlots: MealSlot[];
  history: PlanHistoryItem[];
};

const SHORT = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

/** Plan de la semana: lista de días con sus momentos, para armar a mano y aprobar. */
export function PlanBoard({
  groupId,
  weekStart,
  today,
  plan: initialPlan,
  initialEntries,
  members,
  currentUserId,
  mealSlots,
  history,
}: Props) {
  const router = useRouter();
  const [plan, setPlan] = useState(initialPlan);
  const [entries, setEntries] = useState(initialEntries);
  const [adding, setAdding] = useState<{ date: string; slot: MealSlot } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [changedAfterApproval, setChangedAfterApproval] = useState(false);
  const [pending, start] = useTransition();
  const [chatOpen, setChatOpen] = useState(false);
  const finalize = useFinalize(plan?.id ?? null);
  // Tras un router.refresh() el servidor puede traer el plan recién creado o cambios propios.
  const [seen, setSeen] = useState({ plan: initialPlan, entries: initialEntries });
  if (seen.plan !== initialPlan || seen.entries !== initialEntries) {
    setSeen({ plan: initialPlan, entries: initialEntries });
    setPlan(initialPlan);
    setEntries(initialEntries);
  }
  const [warnings, setWarnings] = useState<Record<string, string[]>>({});
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const { others } = useRealtimePlan({
    planId: plan?.id ?? null,
    userId: currentUserId,
    userName: members.find((m) => m.id === currentUserId)?.name ?? "Alguien",
    onEntries: setEntries,
  });

  const days = weekDays(weekStart);
  const inWeek = days.includes(today);
  // En la semana actual, hoy va primero y los días que ya pasaron quedan al final.
  const ordered = inWeek
    ? [...days.filter((d) => d >= today), ...days.filter((d) => d < today)]
    : days;
  const editing = entries.find((e) => e.id === editingId) ?? null;
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const prev = history.find((h) => h.week_start === addDays(weekStart, -7));
  const approved = plan?.status === "approved";

  function onAiUpdate(u: {
    entries: PlanEntry[];
    warnings: { entryId: string; message: string }[];
    changedIds: string[];
  }) {
    setEntries(u.entries);
    const byEntry: Record<string, string[]> = {};
    for (const w of u.warnings) (byEntry[w.entryId] ??= []).push(w.message);
    setWarnings(byEntry);
    setFresh(new Set(u.changedIds));
    setTimeout(() => setFresh(new Set()), 4000);
  }

  function openAi() {
    if (plan) return setChatOpen(true);
    start(async () => {
      const res = await createPlan({ groupId, weekStart });
      if (!res.ok) return void toast.error(res.error);
      router.refresh();
      setChatOpen(true);
    });
  }

  const touch = () => approved && setChangedAfterApproval(true);

  function createManual() {
    start(async () => {
      const res = await createPlan({ groupId, weekStart });
      if (!res.ok) return void toast.error(res.error);
      router.refresh();
    });
  }

  function repeat(planId: string) {
    start(async () => {
      const res = await duplicatePlan({ planId, groupId, weekStart });
      if (!res.ok) return void toast.error(res.error);
      setRepeatOpen(false);
      router.refresh();
    });
  }

  function pick(choice: { recipeId?: string; freeText?: string }) {
    if (!plan || !adding) return;
    start(async () => {
      const res = await addEntry({
        planId: plan.id,
        date: adding.date,
        slot: adding.slot,
        ...choice,
      });
      if (!res.ok) return void toast.error(res.error);
      setEntries((prevEntries) => [...prevEntries, res.data]);
      setAdding(null);
      touch();
    });
  }

  function save(id: string, patch: Patch) {
    start(async () => {
      const res = await updateEntry({ id, patch });
      if (!res.ok) return void toast.error(res.error);
      setEntries((prevEntries) => prevEntries.map((e) => (e.id === id ? res.data : e)));
      setEditingId(null);
      touch();
    });
  }

  function remove(id: string) {
    start(async () => {
      const res = await removeEntry({ id });
      if (!res.ok) return void toast.error(res.error);
      setEntries((prevEntries) => prevEntries.filter((e) => e.id !== id));
      setEditingId(null);
      touch();
    });
  }

  function discard() {
    if (
      !plan ||
      !window.confirm(
        "¿Descartar este borrador? Se borra el plan y las recetas nuevas que armó la IA.",
      )
    )
      return;
    start(async () => {
      const res = await discardPlan({ planId: plan.id, groupId });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Borrador descartado.");
      router.refresh();
    });
  }

  function updateList() {
    if (!plan) return;
    start(async () => {
      const res = await generateListForPlan({ planId: plan.id, groupId });
      if (!res.ok) return void toast.error(res.error);
      setChangedAfterApproval(false);
      toast.success("Lista de compras actualizada.");
    });
  }

  function approve() {
    if (!plan) return;
    start(async () => {
      const res = await approvePlan({ planId: plan.id, groupId });
      if (!res.ok) return void toast.error(res.error);
      // Lista de compras, consejos y preparaciones se arman solos, con el avance a la vista.
      void finalize.run();
      setPlan({ ...plan, status: "approved", approved_at: new Date().toISOString() });
      setChangedAfterApproval(false);
      toast.success("¡Plan aprobado!");
      router.refresh();
    });
  }

  const header = (
    <header className="flex flex-col gap-1 px-5 pt-1 pb-2">
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-bold",
            approved ? "bg-success/15 text-success" : "bg-surface-2 text-accent",
          )}
        >
          {plan ? (approved ? "Aprobado" : "Borrador") : "Sin plan"}
        </span>
        <div className="flex items-center gap-1">
          <Link
            href={`/g/${groupId}/plan/${addDays(weekStart, -7)}`}
            aria-label="Semana anterior"
            className="flex size-11 items-center justify-center rounded-full"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </Link>
          <Link
            href={`/g/${groupId}/plan/${addDays(weekStart, 7)}`}
            aria-label="Semana siguiente"
            className="flex size-11 items-center justify-center rounded-full"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Más opciones del plan"
                className="flex size-11 items-center justify-center rounded-full"
              >
                <MoreVertical className="size-5" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {prev && plan ? (
                <DropdownMenuItem disabled>La semana ya tiene plan</DropdownMenuItem>
              ) : prev ? (
                <DropdownMenuItem onSelect={() => repeat(prev.id)}>
                  Duplicar semana anterior
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={openAi}>
                <Sparkles className="size-4" /> Armar con IA
              </DropdownMenuItem>
              {plan && !approved ? (
                <DropdownMenuItem onSelect={discard}>Descartar borrador</DropdownMenuItem>
              ) : null}
              <DropdownMenuItem asChild>
                <Link href={`/g/${groupId}/plan/historial`}>
                  <History className="size-4" /> Historial
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {others.length > 0 ? (
        <p role="status" className="text-xs font-semibold text-accent">
          {others.length === 1
            ? `${others[0]} está viendo este plan`
            : `${others.join(", ")} están viendo este plan`}
        </p>
      ) : null}
      <h2 className="font-display text-[30px] leading-[1.05] font-normal">
        {formatWeekLabel(weekStart)}
      </h2>
    </header>
  );

  if (!plan) {
    return (
      <div className="flex flex-1 flex-col">
        {header}
        <EmptyState
          icon={CalendarDays}
          title="Todavía no hay plan"
          description="Armá la semana a mano, repetí una anterior o dejá que la IA te ayude."
        />
        <div className="flex flex-col gap-2 px-5 pb-8">
          <PillButton fullWidth disabled={pending} onClick={createManual}>
            <Plus /> Armar a mano
          </PillButton>
          <PillButton fullWidth variant="outline" size="md" disabled={pending} onClick={openAi}>
            <Sparkles /> Armar con IA
          </PillButton>
          {history.length > 0 ? (
            <PillButton fullWidth variant="soft" size="md" onClick={() => setRepeatOpen(true)}>
              Repetir una semana anterior
            </PillButton>
          ) : null}
        </div>
        <Sheet open={repeatOpen} onOpenChange={setRepeatOpen}>
          <SheetContent side="bottom" className="max-h-[80dvh] rounded-t-3xl">
            <SheetHeader>
              <SheetTitle>Repetir una semana</SheetTitle>
              <SheetDescription>
                Se copian las recetas, los momentos y los comensales.
              </SheetDescription>
            </SheetHeader>
            <ul className="flex max-h-[60dvh] flex-col gap-2 overflow-y-auto px-4 pb-6">
              {history.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => repeat(h.id)}
                    className="flex min-h-14 w-full items-center justify-between rounded-2xl border border-border bg-surface px-4 text-left"
                  >
                    <span className="text-[15px] font-semibold">
                      {formatWeekLabel(h.week_start)}
                    </span>
                    <span className="text-xs text-muted">{h.entryCount} comidas</span>
                  </button>
                </li>
              ))}
            </ul>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col pb-28">
      {header}
      {finalize.state.running ? (
        <p role="status" className="mx-5 mb-2 rounded-2xl bg-hero px-4 py-2.5 text-sm font-medium">
          {finalize.state.label ?? "Armando tu lista y tus preparaciones…"}
        </p>
      ) : null}
      {!finalize.state.running && finalize.state.failed.length > 0 ? (
        <p role="alert" className="mx-5 mb-2 rounded-2xl bg-hero px-4 py-2.5 text-sm font-medium">
          No pudimos terminar todo.{" "}
          <button
            type="button"
            className="min-h-11 font-bold underline"
            onClick={() => void finalize.retry()}
          >
            Reintentar
          </button>
        </p>
      ) : null}
      {changedAfterApproval ? (
        <p role="status" className="mx-5 mb-2 rounded-2xl bg-hero px-4 py-2.5 text-sm font-medium">
          Cambiaste el plan aprobado.{" "}
          <button type="button" className="min-h-11 font-bold underline" onClick={updateList}>
            Actualizar la lista de compras
          </button>
        </p>
      ) : null}

      <ol className="flex flex-col gap-3 px-4">
        {ordered.map((date) => {
          const dayEntries = entries.filter((e) => e.date === date);
          const emptySlots = mealSlots.filter((s) => !dayEntries.some((e) => e.slot === s));
          const isToday = date === today;
          const past = inWeek && date < today;
          return (
            <li key={date} className={cn("flex flex-col gap-1.5", past && "opacity-70")}>
              <h3
                className={cn(
                  "flex items-baseline gap-2 px-1 text-xs font-bold tracking-wide",
                  isToday ? "text-accent" : "text-muted",
                )}
              >
                <span>{SHORT[new Date(`${date}T00:00:00Z`).getUTCDay()]}</span>
                <span className="text-sm font-semibold normal-case">{dayLabel(date)}</span>
                {isToday ? <span>· hoy</span> : null}
              </h3>
              {MEAL_SLOTS.filter((s) => dayEntries.some((e) => e.slot === s.key)).flatMap((s) =>
                dayEntries
                  .filter((e) => e.slot === s.key)
                  .map((e) => (
                    <EntryRow
                      key={e.id}
                      entry={e}
                      members={members}
                      leftoverOf={
                        e.leftovers_of_entry_id ? byId.get(e.leftovers_of_entry_id) : undefined
                      }
                      highlighted={fresh.has(e.id)}
                      warnings={warnings[e.id]}
                      onOpen={() => setEditingId(e.id)}
                    />
                  )),
              )}
              {emptySlots.length > 0 ? (
                <div
                  className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-dashed border-border px-3 py-1.5"
                  role="group"
                  aria-label={`Agregar comida el ${dayLabel(date)}`}
                >
                  <Plus className="size-4 text-muted" aria-hidden="true" />
                  {emptySlots.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setAdding({ date, slot: s })}
                      className="min-h-11 rounded-full px-2.5 text-sm text-muted"
                    >
                      Agregar {slotLabel(s).toLowerCase()}
                    </button>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {!approved ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom)+12px)] z-20 mx-auto max-w-md px-5">
          <PillButton
            fullWidth
            className="pointer-events-auto shadow-lg"
            disabled={pending || entries.length === 0}
            onClick={approve}
          >
            Aprobar plan
          </PillButton>
        </div>
      ) : null}

      {plan ? (
        <PlanChatSheet
          planId={plan.id}
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          onPlanUpdated={onAiUpdate}
        />
      ) : null}
      <AddEntrySheet
        open={adding !== null}
        onOpenChange={(open) => !open && setAdding(null)}
        groupId={groupId}
        date={adding?.date ?? weekStart}
        slot={adding?.slot ?? "lunch"}
        busy={pending}
        onPick={pick}
      />
      <EditEntrySheet
        entry={editing}
        members={members}
        earlier={
          editing
            ? entries
                .filter(
                  (e) => e.id !== editing.id && (e.date < editing.date || e.cook_date === e.date),
                )
                .filter((e) => e.date <= editing.date && e.recipe_id)
            : []
        }
        busy={pending}
        reviewHref={
          editing?.recipe?.status === "draft" && editing.recipe_id
            ? `/g/${groupId}/recetas/${editing.recipe_id}`
            : undefined
        }
        onOpenChange={(open) => !open && setEditingId(null)}
        onSave={save}
        onRemove={remove}
      />
    </div>
  );
}
