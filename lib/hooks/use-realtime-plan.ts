"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchPlanEntries } from "@/lib/plan/actions";
import type { PlanEntry } from "@/lib/plan/types";

/**
 * Escucha cambios de `meal_plan_entries` del plan abierto y avisa quién más está mirándolo.
 * `onEntries` recibe la lista completa y actualizada (se vuelve a leer del servidor, con RLS).
 */
export function useRealtimePlan({
  planId,
  userId,
  userName,
  onEntries,
}: {
  planId: string | null;
  userId: string;
  userName: string;
  onEntries: (entries: PlanEntry[]) => void;
}) {
  const [others, setOthers] = useState<string[]>([]);
  const handler = useRef(onEntries);
  useEffect(() => {
    handler.current = onEntries;
  });

  useEffect(() => {
    if (!planId) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const refresh = () => {
      // Agrupa ráfagas de cambios (ej. duplicar una semana) en una sola lectura.
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const rows = await fetchPlanEntries(planId);
        if (!cancelled) handler.current(rows);
      }, 150);
    };

    let channel: ReturnType<typeof supabase.channel> | undefined;

    const start = async () => {
      // Sin el token del usuario, Realtime filtra los cambios por RLS y no llega nada.
      const { data } = await supabase.auth.getSession();
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;
      const ch = supabase
        .channel(`plan:${planId}`, { config: { presence: { key: userId } } })
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "meal_plan_entries",
            filter: `plan_id=eq.${planId}`,
          },
          refresh,
        )
        .on("presence", { event: "sync" }, () => {
          const state = ch.presenceState<{ name: string }>();
          setOthers(
            Object.entries(state)
              .filter(([key]) => key !== userId)
              .map(([, metas]) => metas[0]?.name ?? "Alguien"),
          );
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") void ch.track({ name: userName });
        });
      channel = ch;
    };
    void start();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [planId, userId, userName]);

  return { others };
}
