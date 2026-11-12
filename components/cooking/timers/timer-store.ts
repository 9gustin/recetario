import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

/**
 * Timers del modo cocinar. Se guardan con **timestamps** (`endsAt`), no contando ticks: así el
 * tiempo restante es correcto aunque la app haya estado en segundo plano o con la pantalla bloqueada.
 */
export type TimerStatus = "running" | "paused" | "done";

export type CookTimer = {
  id: string;
  recipeId: string;
  stepIndex: number;
  label: string;
  durationSeconds: number;
  /** Paso "pasivo" (horno, reposo): se puede seguir con el próximo paso. */
  passive: boolean;
  /** Momento (ms epoch) en que termina; solo con status "running". */
  endsAt: number | null;
  /** Milisegundos que faltaban al pausar; solo con status "paused". */
  pausedRemaining: number | null;
  status: TimerStatus;
};

export type TimerInput = Pick<
  CookTimer,
  "recipeId" | "stepIndex" | "label" | "durationSeconds" | "passive"
>;

export const timerId = (recipeId: string, stepIndex: number) => `${recipeId}:${stepIndex}`;

/** Milisegundos que faltan (0 si ya terminó). */
export function remainingMs(t: CookTimer, now: number): number {
  if (t.status === "done") return 0;
  if (t.status === "paused") return Math.max(0, t.pausedRemaining ?? 0);
  return Math.max(0, (t.endsAt ?? now) - now);
}

/** ¿Un timer en marcha ya llegó a cero? */
export function isFinished(t: CookTimer, now: number): boolean {
  return t.status === "running" && (t.endsAt ?? Infinity) <= now;
}

export function createTimer(input: TimerInput, now: number): CookTimer {
  return {
    ...input,
    id: timerId(input.recipeId, input.stepIndex),
    endsAt: now + input.durationSeconds * 1000,
    pausedRemaining: null,
    status: "running",
  };
}

export function pauseTimer(t: CookTimer, now: number): CookTimer {
  if (t.status !== "running") return t;
  return { ...t, status: "paused", pausedRemaining: remainingMs(t, now), endsAt: null };
}

export function resumeTimer(t: CookTimer, now: number): CookTimer {
  if (t.status !== "paused") return t;
  return { ...t, status: "running", endsAt: now + (t.pausedRemaining ?? 0), pausedRemaining: null };
}

/** Suma un minuto (también a un timer que ya terminó: lo vuelve a poner en marcha). */
export function addMinute(t: CookTimer, now: number): CookTimer {
  if (t.status === "running") return { ...t, endsAt: (t.endsAt ?? now) + 60_000 };
  if (t.status === "paused") return { ...t, pausedRemaining: (t.pausedRemaining ?? 0) + 60_000 };
  return { ...t, status: "running", endsAt: now + 60_000, pausedRemaining: null };
}

export function finishTimer(t: CookTimer): CookTimer {
  return { ...t, status: "done", endsAt: null, pausedRemaining: null };
}

const noopStorage: StateStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

type TimerState = {
  timers: Record<string, CookTimer>;
  start: (input: TimerInput, now?: number) => CookTimer;
  pause: (id: string, now?: number) => void;
  resume: (id: string, now?: number) => void;
  addMinute: (id: string, now?: number) => void;
  /** Vuelve a la duración original y la deja en marcha. */
  restart: (id: string, now?: number) => void;
  /** Marca como terminados los que ya llegaron a cero y devuelve esos timers. */
  collectFinished: (now?: number) => CookTimer[];
  remove: (id: string) => void;
};

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => {
      const update = (id: string, fn: (t: CookTimer) => CookTimer) => {
        const current = get().timers[id];
        if (current) set({ timers: { ...get().timers, [id]: fn(current) } });
      };
      return {
        timers: {},
        start: (input, now = Date.now()) => {
          const timer = createTimer(input, now);
          set({ timers: { ...get().timers, [timer.id]: timer } });
          return timer;
        },
        pause: (id, now = Date.now()) => update(id, (t) => pauseTimer(t, now)),
        resume: (id, now = Date.now()) => update(id, (t) => resumeTimer(t, now)),
        addMinute: (id, now = Date.now()) => update(id, (t) => addMinute(t, now)),
        restart: (id, now = Date.now()) => update(id, (t) => createTimer(t, now)),
        collectFinished: (now = Date.now()) => {
          const finished = Object.values(get().timers).filter((t) => isFinished(t, now));
          if (finished.length === 0) return [];
          const next = { ...get().timers };
          for (const t of finished) next[t.id] = finishTimer(t);
          set({ timers: next });
          return finished.map(finishTimer);
        },
        remove: (id) => {
          const next = { ...get().timers };
          delete next[id];
          set({ timers: next });
        },
      };
    },
    {
      name: "recetario-timers",
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? noopStorage : localStorage,
      ),
      // Se rehidrata a mano en el cliente (evita desajustes con el HTML del servidor).
      skipHydration: true,
      partialize: (s) => ({ timers: s.timers }),
      merge: (persisted, current) => {
        const saved = (persisted as Pick<TimerState, "timers"> | undefined)?.timers ?? {};
        const now = Date.now();
        const fresh = Object.fromEntries(
          Object.entries(saved).filter(([, t]) => {
            const ref = t.endsAt ?? now;
            return now - ref < MAX_AGE_MS;
          }),
        );
        return { ...current, timers: fresh };
      },
    },
  ),
);
