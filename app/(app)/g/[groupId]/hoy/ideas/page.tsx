import { Ideas } from "@/components/suggest/ideas";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Ideas para hoy" };

export default async function Page({ params }: { params: Promise<{ groupId: string }> }) {
  await requireUser();
  const { groupId } = await params;
  return <Ideas groupId={groupId} />;
}
