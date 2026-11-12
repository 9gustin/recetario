import { HaveForm } from "@/components/suggest/have-form";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "¿Qué tenés?" };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  await requireUser();
  const { groupId } = await params;
  const { q } = await searchParams;
  return <HaveForm groupId={groupId} initialCraving={(q ?? "").slice(0, 200)} />;
}
