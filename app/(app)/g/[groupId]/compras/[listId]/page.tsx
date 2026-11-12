import { notFound } from "next/navigation";
import { ListView } from "@/components/shopping/list-view";
import { requireUser } from "@/lib/auth";
import { getPlanMembers } from "@/lib/plan/queries";
import { getList, getListItems } from "@/lib/shopping/queries";

export const metadata = { title: "Compras" };

export default async function Page({
  params,
}: {
  params: Promise<{ groupId: string; listId: string }>;
}) {
  await requireUser();
  const { groupId, listId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(listId)) notFound();
  const list = await getList(listId);
  if (!list || list.group_id !== groupId) notFound();
  const [items, members] = await Promise.all([getListItems(listId), getPlanMembers(groupId)]);
  return <ListView key={list.id} list={list} initialItems={items} members={members} />;
}
