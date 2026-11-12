"use client";

import { toast } from "sonner";
import { PillButton } from "@/components/shared/pill-button";

export function ShareSummary({ text }: { text: string }) {
  async function share() {
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success("Resumen copiado.");
      }
    } catch {
      // Canceló el diálogo de compartir.
    }
  }
  return (
    <PillButton variant="outline" size="md" onClick={() => void share()}>
      Compartir resumen
    </PillButton>
  );
}
