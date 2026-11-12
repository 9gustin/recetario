import { CompatBadges, statusLabel, type CompatStatus } from "../compat-badges";

export type MemberReason = {
  ingredient: string;
  restriction: string;
  severity: "forbidden" | "limit" | "unknown";
  note?: string;
};
export type ForWhomMember = {
  userId: string;
  name: string | null;
  status: CompatStatus;
  reasons: MemberReason[];
};

function reasonText(name: string, r: MemberReason): string {
  if (r.severity === "unknown") return `Revisá: ${r.ingredient} no está en el catálogo.`;
  if (r.note === "es opcional, sacalo")
    return `${r.ingredient} es opcional, sacalo (${name} no come ${r.restriction}).`;
  if (r.severity === "forbidden") return `Tiene ${r.ingredient}: ${name} no come ${r.restriction}.`;
  return `${r.ingredient}: ${name} limita ${r.restriction}${r.note ? ` (${r.note})` : ""}.`;
}

/** Bloque "Para quién va": estado por persona y las razones concretas. */
export function ForWhom({ members }: { members: ForWhomMember[] }) {
  if (members.length === 0) return null;
  return (
    <section
      className="flex flex-col gap-2 rounded-[20px] bg-surface p-4"
      aria-label="Para quién va"
    >
      <h2 className="font-display text-[22px] font-normal">Para quién va</h2>
      <ul className="flex flex-col gap-3">
        {members.map((m) => {
          const name = m.name?.trim() || "Alguien";
          return (
            <li key={m.userId} className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-[15px]">
                <CompatBadges compat={[{ userId: m.userId, name, status: m.status }]} />
                <span className="font-semibold">{name}</span>
                <span className="text-muted">· {statusLabel(m.status)}</span>
              </div>
              {m.reasons.length > 0 ? (
                <ul className="ml-1 flex flex-col gap-0.5 text-sm text-muted">
                  {m.reasons.map((r, i) => (
                    <li key={i}>• {reasonText(name, r)}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
