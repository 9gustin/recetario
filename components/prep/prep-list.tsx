"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Plus, Snowflake, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { groupByDay, sortTasks } from "@/lib/domain/prep-days";
import { dayLabel } from "@/lib/domain/week";
import {
  addManualTask,
  deleteTask,
  moveTask,
  setPrepDone,
  type PrepTaskRow,
} from "@/lib/prep/actions";
import { cn } from "@/lib/utils";

/** Preparaciones por día con duración total, tildado, mover de día, borrar y agregar a mano; tips plegables. */
export function PrepList({
  planId,
  weekStart,
  initialTasks,
  tips,
}: {
  planId: string;
  weekStart: string;
  initialTasks: PrepTaskRow[];
  tips: string[];
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(weekStart);
  const [, start] = useTransition();
  const groups = groupByDay(tasks);

  function toggle(t: PrepTaskRow) {
    const done = !t.done_at;
    setTasks((prev) =>
      prev.map((x) =>
        x.id === t.id ? { ...x, done_at: done ? new Date().toISOString() : null } : x,
      ),
    );
    start(async () => {
      const res = await setPrepDone({ id: t.id, done });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo actualizar.");
        router.refresh();
      }
    });
  }

  function remove(t: PrepTaskRow) {
    setTasks((prev) => prev.filter((x) => x.id !== t.id));
    start(async () => void (await deleteTask({ id: t.id })));
  }

  function move(t: PrepTaskRow, to: string) {
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, suggested_date: to } : x)));
    start(async () => void (await moveTask({ id: t.id, date: to })));
  }

  function add() {
    const name = title.trim();
    if (!name) return;
    setTitle("");
    start(async () => {
      const res = await addManualTask({ planId, title: name, date });
      if (!res.ok) return void toast.error(res.error);
      setTasks((prev) => [...prev, res.data]);
    });
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-8">
      {tips.length > 0 ? (
        <details className="rounded-2xl bg-hero p-3.5">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[15px] font-semibold">
            Tips de la semana <ChevronDown className="size-4" aria-hidden="true" />
          </summary>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm">
            {tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {groups.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          Todavía no hay preparaciones. Se arman al aprobar el plan.
        </p>
      ) : null}

      {groups.map((g) => (
        <section key={g.date} aria-label={dayLabel(g.date)} className="flex flex-col gap-1.5">
          <h3 className="px-1 text-xs font-bold tracking-wide text-muted uppercase">
            {dayLabel(g.date)}
            {g.totalMinutes > 0 ? ` · ${g.totalMinutes} min` : ""}
          </h3>
          <ul className="flex flex-col gap-1.5">
            {sortTasks(g.tasks).map((t) => (
              <TaskRow key={t.id} task={t} onToggle={toggle} onDelete={remove} onMove={move} />
            ))}
          </ul>
        </section>
      ))}

      <form
        className="flex flex-col gap-2 border-t border-border pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label htmlFor="prep-title" className="text-sm font-medium">
          Agregar una preparación
        </label>
        <input
          id="prep-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Hervir los huevos"
          className="min-h-12 rounded-full border border-border bg-surface px-4 text-[15px] outline-none"
        />
        <div className="flex gap-2">
          <label htmlFor="prep-date" className="sr-only">
            Día
          </label>
          <input
            id="prep-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-h-12 flex-1 rounded-full border border-border bg-surface px-4 text-[15px]"
          />
          <button
            type="submit"
            aria-label="Agregar preparación"
            className="flex size-12 flex-none items-center justify-center rounded-full bg-accent text-accent-foreground"
          >
            <Plus className="size-5" />
          </button>
        </div>
      </form>
    </div>
  );
}

export function TaskRow({
  task,
  onToggle,
  onDelete,
  onMove,
}: {
  task: PrepTaskRow;
  onToggle: (t: PrepTaskRow) => void;
  onDelete?: (t: PrepTaskRow) => void;
  onMove?: (t: PrepTaskRow, date: string) => void;
}) {
  const done = Boolean(task.done_at);
  const thaw = task.kind === "thaw";
  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-2xl px-3 py-2.5",
        thaw ? "bg-hero" : "bg-surface",
        done && "opacity-60",
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`Hecho: ${task.title}`}
        onClick={() => onToggle(task)}
        className={cn(
          "flex size-11 flex-none items-center justify-center rounded-full border-2",
          done ? "border-accent bg-accent text-accent-foreground" : "border-border",
        )}
      >
        {done ? <Check className="size-5" /> : null}
      </button>
      <div className="min-w-0 flex-1 pt-1">
        <p className={cn("text-[15px] font-medium", done && "line-through")}>
          {thaw ? (
            <Snowflake className="mr-1 inline size-4 align-text-bottom" aria-hidden="true" />
          ) : null}
          {task.title}
        </p>
        <p className="text-xs text-muted">
          {[task.duration_minutes ? `${task.duration_minutes} min` : "", task.details]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {onMove && task.suggested_date ? (
          <label className="mt-1 flex items-center gap-2 text-xs text-muted">
            Día
            <input
              type="date"
              value={task.suggested_date}
              onChange={(e) => e.target.value && onMove(task, e.target.value)}
              className="min-h-9 rounded-lg border border-border bg-background px-2"
            />
          </label>
        ) : null}
      </div>
      {onDelete ? (
        <button
          type="button"
          aria-label={`Borrar: ${task.title}`}
          onClick={() => onDelete(task)}
          className="flex size-11 flex-none items-center justify-center rounded-full text-muted"
        >
          <Trash2 className="size-4" />
        </button>
      ) : null}
    </li>
  );
}
