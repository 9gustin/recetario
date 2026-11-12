/** Reglas para retomar una sesión de cocina a medias. Lógica pura, sin DB. */

export const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export type OpenSession = {
  id: string;
  current_step: number;
  servings: number;
  started_at: string;
  finished_at: string | null;
};

/**
 * ¿Se puede retomar? Debe estar sin terminar, tener menos de 12 h, haber pasado la mise en place
 * (pantalla 0) y no estar en la pantalla final.
 */
export function isResumable(session: OpenSession, totalScreens: number, now: number): boolean {
  if (session.finished_at) return false;
  if (now - new Date(session.started_at).getTime() > SESSION_MAX_AGE_MS) return false;
  return session.current_step >= 1 && session.current_step < totalScreens - 1;
}

/** Estado inicial del modo cocinar al retomar: los pasos anteriores quedan completados. */
export function resumeInit(session: OpenSession, steps: number) {
  const index = Math.min(Math.max(session.current_step, 1), steps);
  return {
    steps,
    servings: session.servings,
    index,
    completed: Array.from({ length: index }, (_, i) => i),
  };
}
