import Link from "next/link";
import { redirect } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { EmptyState } from "@/components/shell/empty-state";
import { requireUser } from "@/lib/auth";
import { getActiveLists } from "@/lib/shopping/queries";

export const metadata = { title: "Compras" };

export default async function Page({ params }: { params: Promise<{ groupId: string }> }) {
  await requireUser();
  const { groupId } = await params;
  const lists = await getActiveLists(groupId);

  if (lists.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Tu lista está vacía"
        description="La lista de compras se arma sola cuando aprobás el plan de la semana."
      />
    );
  }
  if (lists.length === 1) redirect(`/g/${groupId}/compras/${lists[0]!.id}`);
  return (
    <ul className="flex flex-col gap-3 px-4">
      {lists.map((l) => (
        <li key={l.id}>
          <Link
            href={`/g/${groupId}/compras/${l.id}`}
            className="flex min-h-14 items-center rounded-2xl bg-surface px-4 text-[15px] font-semibold"
          >
            {l.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
