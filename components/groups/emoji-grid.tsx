"use client";

import { GROUP_EMOJIS } from "@/lib/groups/constants";
import { cn } from "@/lib/utils";

/** Grilla de emojis de comida y casa para elegir el emoji de un grupo. */
export function EmojiGrid({
  value,
  onSelect,
}: {
  value: string | null;
  onSelect: (emoji: string) => void;
}) {
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {GROUP_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          aria-label={emoji}
          onClick={() => onSelect(emoji)}
          className={cn(
            "flex min-h-11 items-center justify-center rounded-xl text-xl transition-colors",
            value === emoji ? "bg-accent/20 ring-2 ring-accent" : "bg-surface-2",
          )}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
