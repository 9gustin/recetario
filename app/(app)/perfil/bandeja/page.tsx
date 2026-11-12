import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getMyGroups } from "@/lib/groups/queries";
import { getInboxItems } from "@/lib/inbox/queries";
import { InboxList } from "@/components/inbox/inbox-list";

export const metadata = { title: "Bandeja" };

export default async function Page() {
  const user = await requireUser();
  const [items, groups] = await Promise.all([getInboxItems(), getMyGroups(user.id)]);

  return (
    <div className="flex flex-col gap-4 px-5 pt-2 pb-8">
      <Link
        href="/perfil"
        className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent"
      >
        <ChevronLeft className="size-4" aria-hidden="true" /> Perfil
      </Link>
      <h2 className="font-display text-[28px] leading-none font-normal">Bandeja</h2>
      <InboxList
        entries={items.map(({ id, kind, payload, created_at }) => ({
          id,
          kind,
          payload,
          created_at,
        }))}
        groups={groups.map((g) => ({
          id: g.id,
          name: g.name,
          emoji: g.emoji,
          is_personal: g.is_personal,
        }))}
      />
    </div>
  );
}
