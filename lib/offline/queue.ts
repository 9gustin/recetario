"use client";

import { get, set } from "idb-keyval";

export type QueuedChange = { id: string; state: "pending" | "bought" | "have_it"; at: number };

const KEY = "recetario-shopping-queue";

/** Se queda con el último cambio de cada ítem (tachar y destachar sin red no manda nada de más). */
export function compact(queue: QueuedChange[]): QueuedChange[] {
  const last = new Map<string, QueuedChange>();
  for (const c of [...queue].sort((a, b) => a.at - b.at)) last.set(c.id, c);
  return [...last.values()];
}

export async function readQueue(): Promise<QueuedChange[]> {
  try {
    return (await get<QueuedChange[]>(KEY)) ?? [];
  } catch {
    return [];
  }
}

export async function enqueue(change: Omit<QueuedChange, "at">): Promise<QueuedChange[]> {
  const next = compact([...(await readQueue()), { ...change, at: Date.now() }]);
  await set(KEY, next).catch(() => undefined);
  return next;
}

/** Manda lo guardado con `send`; lo que falla queda en la cola para el próximo intento. Devuelve cuánto queda. */
export async function flush(send: (c: QueuedChange) => Promise<boolean>): Promise<number> {
  const queue = await readQueue();
  const remaining: QueuedChange[] = [];
  for (const c of queue) {
    let ok = false;
    try {
      ok = await send(c);
    } catch {
      ok = false;
    }
    if (!ok) remaining.push(c);
  }
  await set(KEY, remaining).catch(() => undefined);
  return remaining.length;
}
