import type { LucideIcon } from "lucide-react";

type Props = { icon: LucideIcon; title: string; description: string };

/** Estado vacío: ícono dentro de un círculo del color --hero, título serif y texto. */
export function EmptyState({ icon: Icon, title, description }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-16 text-center">
      <span className="flex size-24 items-center justify-center rounded-full bg-hero">
        <Icon className="size-10 text-foreground" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <h2 className="font-display text-2xl font-normal">{title}</h2>
      <p className="max-w-[260px] text-sm text-muted">{description}</p>
    </div>
  );
}
