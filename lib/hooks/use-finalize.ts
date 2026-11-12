"use client";

import { useCallback, useState } from "react";
import { parseEventBlock } from "@/lib/ai/stream";

export type FinalizeState = {
  running: boolean;
  label: string | null;
  failed: string[];
  done: boolean;
};

/** Corre el pipeline post-aprobación y expone el avance ("Armando tu lista…") con reintento. */
export function useFinalize(planId: string | null) {
  const [state, setState] = useState<FinalizeState>({
    running: false,
    label: null,
    failed: [],
    done: false,
  });

  const run = useCallback(
    async (only?: string[]) => {
      if (!planId) return;
      setState({ running: true, label: "Preparando…", failed: [], done: false });
      const failed: string[] = [];
      try {
        const res = await fetch(`/api/plans/${planId}/finalize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ only }),
        });
        if (!res.ok || !res.body) throw new Error("No se pudo iniciar.");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() ?? "";
          for (const block of blocks) {
            const event = parseEventBlock(block);
            if (!event) continue;
            if (event.type === "step" && event.status === "started")
              setState((s) => ({ ...s, label: `${event.detail ?? "Trabajando"}…` }));
            else if (event.type === "step" && event.status === "error") failed.push(event.name);
          }
        }
      } catch {
        failed.push("connection");
      }
      setState({ running: false, label: null, failed, done: failed.length === 0 });
    },
    [planId],
  );

  const retry = useCallback(
    () =>
      run(
        state.failed.filter((f) => f !== "connection").length
          ? state.failed.filter((f) => f !== "connection")
          : undefined,
      ),
    [run, state.failed],
  );

  return { state, run, retry };
}
