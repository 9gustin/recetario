"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Sin interfaz: avisa cada cambio de pantalla (para el registro de actividad propio). */
export function ActivityBeacon() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    const groupId = pathname.match(/^\/g\/([0-9a-f-]{36})/i)?.[1];
    // Refuerzo del middleware: si una respuesta vino de caché y no trajo la cookie, igual se recuerda el grupo.
    if (groupId)
      document.cookie = `last_group_id=${groupId}; path=/; max-age=31536000; samesite=lax`;
    const body = JSON.stringify({ path: pathname, groupId });
    try {
      navigator.sendBeacon?.("/api/activity", new Blob([body], { type: "application/json" }));
    } catch {
      // Es un extra.
    }
  }, [pathname]);
  return null;
}
