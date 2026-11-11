"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DAY_PART_COOKIE,
  THEME_COLORS,
  resolveDayPart,
  type DayPart,
  type DayPartPreference,
} from "@/lib/theme/day-part";

type DayPartContextValue = {
  dayPart: DayPart;
  preference: DayPartPreference;
  setPreference: (preference: DayPartPreference) => void;
};

const DayPartContext = createContext<DayPartContextValue | null>(null);

function applyToDocument(dayPart: DayPart) {
  document.documentElement.dataset.daypart = dayPart;
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  if (metas.length === 0) {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = THEME_COLORS[dayPart];
    document.head.appendChild(meta);
    return;
  }
  metas.forEach((meta) => {
    meta.content = THEME_COLORS[dayPart];
  });
}

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type Props = {
  children: ReactNode;
  /** Solo en el provider raíz: valores calculados en el servidor (evitan el parpadeo). */
  initialDayPart?: DayPart;
  initialPreference?: DayPartPreference;
  /** Fuerza un tema mientras el componente está montado (el modo cocinar usa siempre "noche"). */
  force?: DayPart;
};

export function DayPartProvider({
  children,
  initialDayPart,
  initialPreference = "auto",
  force,
}: Props) {
  const parent = useContext(DayPartContext);
  const [preference, setPreferenceState] = useState<DayPartPreference>(
    parent?.preference ?? initialPreference,
  );
  const [auto, setAuto] = useState<DayPart>(() => initialDayPart ?? resolveDayPart("auto"));

  // Recalcula cada minuto: el tema cambia solo, sin recargar.
  useEffect(() => {
    if (force) return;
    const id = setInterval(() => setAuto(resolveDayPart("auto")), 60_000);
    return () => clearInterval(id);
  }, [force]);

  const dayPart: DayPart = force ?? (preference === "auto" ? auto : preference);

  // Aplica el tema al <html> y a <meta name="theme-color">.
  useIsomorphicLayoutEffect(() => {
    applyToDocument(dayPart);
  }, [dayPart]);

  // Un provider forzado restaura el tema del padre al desmontarse.
  const parentDayPart = parent?.dayPart;
  useIsomorphicLayoutEffect(() => {
    if (!force || !parentDayPart) return;
    return () => applyToDocument(parentDayPart);
  }, [force, parentDayPart]);

  const setPreference = useCallback(
    (next: DayPartPreference) => {
      if (parent) {
        parent.setPreference(next);
        return;
      }
      setPreferenceState(next);
      document.cookie = `${DAY_PART_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      if (next === "auto") setAuto(resolveDayPart("auto"));
    },
    [parent],
  );

  const value = useMemo(
    () => ({ dayPart, preference: parent?.preference ?? preference, setPreference }),
    [dayPart, parent?.preference, preference, setPreference],
  );

  return <DayPartContext.Provider value={value}>{children}</DayPartContext.Provider>;
}

export function useDayPart(): DayPartContextValue {
  const ctx = useContext(DayPartContext);
  if (!ctx) throw new Error("useDayPart debe usarse dentro de <DayPartProvider>");
  return ctx;
}
