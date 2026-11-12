import { Ban, Check, CircleHelp, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type CompatStatus = "ok" | "limit" | "forbidden" | "unknown";
export type CompatMember = { userId: string; name: string | null; status: CompatStatus };

const LABEL: Record<CompatStatus, string> = {
  ok: "apta",
  limit: "con cuidado",
  forbidden: "no apta",
  unknown: "para revisar",
};

const ICON = { ok: Check, limit: TriangleAlert, forbidden: Ban, unknown: CircleHelp } as const;
const TONE: Record<CompatStatus, string> = {
  ok: "text-success",
  limit: "text-accent",
  forbidden: "text-danger-soft",
  unknown: "text-muted",
};

export const statusLabel = (s: CompatStatus) => LABEL[s];

/** Estado de la receta para cada persona del grupo con perfil: inicial + ícono (✓ apta, ⚠ con cuidado, ⛔ no apta). */
export function CompatBadges({ compat }: { compat: CompatMember[] }) {
  if (compat.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Compatibilidad con cada persona">
      {compat.map((m) => {
        const Icon = ICON[m.status];
        const name = m.name?.trim() || "Alguien";
        return (
          <li
            key={m.userId}
            aria-label={`${name}: ${LABEL[m.status]}`}
            title={`${name}: ${LABEL[m.status]}`}
            className="flex items-center gap-0.5 rounded-full bg-surface-2 py-0.5 pr-1.5 pl-1"
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-hero text-[11px] font-bold">
              {name.slice(0, 1).toUpperCase()}
            </span>
            <Icon className={cn("size-3.5", TONE[m.status])} aria-hidden="true" />
          </li>
        );
      })}
    </ul>
  );
}
