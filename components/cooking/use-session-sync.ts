"use client";

import { useCallback, useEffect, useRef } from "react";
import type { CookingEdit } from "@/lib/domain/apply-cooking-edits";
import {
  discardCookingSession,
  startCookingSession,
  updateCookingProgress,
} from "@/lib/cooking/actions";

const DEBOUNCE_MS = 1000;
const RETRY_MS = 5000;

type Args = {
  recipeId: string;
  /** Sesión retomada (si había una a medias). */
  initialSessionId: string | null;
  /** Pantalla actual y porciones: cada cambio se guarda con un debounce de 1 s. */
  index: number;
  servings: number;
  /** Ajustes hechos cocinando: se guardan junto con el progreso. */
  edits: CookingEdit[];
};

/**
 * Crea la sesión al empezar y guarda el paso actual en la base. Si no hay red, reintenta cada 5 s
 * y apenas vuelve la conexión.
 */
export function useSessionSync({ recipeId, initialSessionId, index, servings, edits }: Args) {
  const sessionId = useRef<string | null>(initialSessionId);
  const started = useRef(initialSessionId !== null);
  const latest = useRef({ index, servings, edits });
  const sent = useRef<{ index: number; servings: number; edits: CookingEdit[] } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef(false);
  const flushRef = useRef<() => Promise<void>>(async () => {});

  const schedule = useCallback((ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flushRef.current(), ms);
  }, []);

  const flush = useCallback(async () => {
    if (!started.current || inflight.current) return;
    inflight.current = true;
    const snapshot = { ...latest.current };
    try {
      if (!sessionId.current) {
        const created = await startCookingSession({ recipeId, servings: snapshot.servings });
        if (!created.ok) throw new Error(created.error);
        sessionId.current = created.data.id;
      }
      const saved = await updateCookingProgress({
        sessionId: sessionId.current,
        currentStep: snapshot.index,
        servings: snapshot.servings,
        pendingEdits: snapshot.edits,
      });
      if (!saved.ok) throw new Error(saved.error);
      sent.current = snapshot;
    } catch {
      schedule(RETRY_MS);
    } finally {
      inflight.current = false;
    }
    // Si mientras guardábamos cambió el paso, se vuelve a guardar.
    const last = sent.current;
    if (
      started.current &&
      last &&
      (last.index !== latest.current.index ||
        last.servings !== latest.current.servings ||
        last.edits !== latest.current.edits)
    ) {
      schedule(DEBOUNCE_MS);
    }
  }, [recipeId, schedule]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  useEffect(() => {
    latest.current = { index, servings, edits };
    if (started.current) schedule(DEBOUNCE_MS);
  }, [index, servings, edits, schedule]);

  useEffect(() => {
    const onOnline = () => void flushRef.current();
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  /** Al tocar "Empezar": desde acá la sesión se guarda. */
  const begin = useCallback(() => {
    started.current = true;
    schedule(0);
  }, [schedule]);

  /** "Empezar de nuevo": descarta la sesión a medias. */
  const discard = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    const id = sessionId.current;
    sessionId.current = null;
    started.current = false;
    sent.current = null;
    if (id) void discardCookingSession({ sessionId: id });
  }, []);

  return { begin, discard };
}
