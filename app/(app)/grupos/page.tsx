import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getMyGroups } from "@/lib/groups/queries";
import { ROLE_LABELS } from "@/lib/groups/constants";

export const metadata = { title: "Grupos" };

export default async function Page() {
  const user = await requireUser();
  const groups = await getMyGroups(user.id);

  return (
    <main className="flex flex-col gap-3 px-5 pt-5">
      <h1 className="font-display text-[34px] leading-none font-normal">Grupos</h1>

      {groups.map((g) => (
        <Link
          key={g.id}
          href={`/grupos/${g.id}`}
          className="flex min-h-[60px] items-center gap-3 rounded-2xl bg-surface px-4"
        >
          <span className="flex size-10 flex-none items-center justify-center rounded-full bg-surface-2 text-xl">
            {g.emoji ?? "🏠"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold">{g.name}</span>
            <span className="block text-[13px] text-muted">
              {g.member_count} {g.member_count === 1 ? "persona" : "personas"} ·{" "}
              {ROLE_LABELS[g.role] ?? g.role}
            </span>
          </span>
          <ChevronRight className="size-5 text-muted" aria-hidden="true" />
        </Link>
      ))}
    </main>
  );
}
