"use client";

import { useEffect, useRef } from "react";

type Sentinel = { released: boolean; release: () => Promise<void> };

type Options = {
  /** Se llama una sola vez si el navegador no soporta mantener la pantalla encendida. */
  onUnsupported?: () => void;
};

/**
 * Mantiene la pantalla encendida mientras el componente está montado (Wake Lock API).
 * El navegador lo suelta al cambiar de pestaña, así que se vuelve a pedir en `visibilitychange`.
 */
export function useWakeLock({ onUnsupported }: Options = {}) {
  const callback = useRef(onUnsupported);
  useEffect(() => {
    callback.current = onUnsupported;
  }, [onUnsupported]);

  useEffect(() => {
    const wakeLock = (
      navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Sentinel> } }
    ).wakeLock;
    if (!wakeLock) {
      callback.current?.();
      return;
    }

    let sentinel: Sentinel | null = null;
    let cancelled = false;

    async function acquire() {
      if (document.visibilityState !== "visible" || (sentinel && !sentinel.released)) return;
      try {
        const lock = await wakeLock!.request("screen");
        if (cancelled) void lock.release();
        else sentinel = lock;
      } catch {
        // Puede fallar (batería baja, ahorro de energía): se reintenta al volver a la pantalla.
      }
    }

    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      void sentinel?.release();
    };
  }, []);
}
