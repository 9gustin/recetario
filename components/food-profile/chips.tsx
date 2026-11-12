"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ChipProps = {
  label: string;
  tone: "forbidden" | "limit" | "neutral";
  onRemove?: () => void;
  title?: string;
};

/** Chip de restricción: rosado = no come, ámbar = limita, neutro = gusto. */
export function Chip({ label, tone, onRemove, title }: ChipProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold",
        tone === "forbidden" && "bg-danger-soft/15 text-danger-soft",
        tone === "limit" && "bg-accent/15 text-accent",
        tone === "neutral" && "bg-surface-2 text-foreground",
      )}
    >
      {label}
      {onRemove ? (
        <button
          type="button"
          aria-label={`Quitar ${label}`}
          onClick={onRemove}
          className="-mr-1.5 flex size-9 items-center justify-center rounded-full"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}
