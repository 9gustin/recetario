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
    const body = JSON.stringify({ path: pathname, groupId });
    try {
      navigator.sendBeacon?.("/api/activity", new Blob([body], { type: "application/json" }));
    } catch {
      // Es un extra.
    }
  }, [pathname]);
  return null;
}
