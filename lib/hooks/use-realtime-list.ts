"use client";

import { useEffect, useRef } from "react";
import { fetchListItems } from "@/lib/shopping/actions";
import type { ListItem } from "@/lib/shopping/types";
import { createClient } from "@/lib/supabase/client";

/** Escucha cambios de los ítems de la lista y entrega la lista completa y actualizada. */
export function useRealtimeList(listId: string, onItems: (items: ListItem[]) => void) {
  const handler = useRef(onItems);
  useEffect(() => {
    handler.current = onItems;
  });

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const rows = await fetchListItems(listId);
        if (!cancelled) handler.current(rows);
      }, 120);
    };

    const start = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;
      channel = supabase
        .channel(`list:${listId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "shopping_list_items",
            filter: `list_id=eq.${listId}`,
          },
          refresh,
        )
        .subscribe();
    };
    void start();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [listId]);
}
