import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  /** Acción a la derecha (ej. "Ver todo"). */
  action?: ReactNode;
  as?: "h2" | "h3";
  className?: string;
};

export function SectionTitle({ children, action, as: Tag = "h2", className }: Props) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <Tag className="font-display text-[22px] leading-tight font-normal">{children}</Tag>
      {action}
    </div>
  );
}
