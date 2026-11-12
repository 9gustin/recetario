"use client";

import { useState, useTransition } from "react";
import { setPrepDone, type PrepTaskRow } from "@/lib/prep/actions";
import { sortTasks } from "@/lib/domain/prep-days";
import { TaskRow } from "./prep-list";

/** "Para preparar hoy": las tareas del día con su checkbox (descongelar, destacado arriba). */
export function PrepToday({ tasks: initial }: { tasks: PrepTaskRow[] }) {
  const [tasks, setTasks] = useState(initial);
  const [, start] = useTransition();
  function toggle(t: PrepTaskRow) {
    const done = !t.done_at;
    setTasks((prev) =>
      prev.map((x) =>
        x.id === t.id ? { ...x, done_at: done ? new Date().toISOString() : null } : x,
      ),
    );
    start(async () => void (await setPrepDone({ id: t.id, done })));
  }
  return (
    <section className="flex flex-col gap-2 px-5" aria-labelledby="prep-hoy">
      <h2 id="prep-hoy" className="font-display text-xl font-normal">
        Para preparar hoy
      </h2>
      <ul className="flex flex-col gap-1.5">
        {sortTasks(tasks).map((t) => (
          <TaskRow key={t.id} task={t} onToggle={toggle} />
        ))}
      </ul>
    </section>
  );
}
