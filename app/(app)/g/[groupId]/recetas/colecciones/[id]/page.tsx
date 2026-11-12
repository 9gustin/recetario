import { notFound } from "next/navigation";
import { CollectionManager } from "@/components/collections/collection-manager";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Colección" };

export default async function Page({
  params,
}: {
  params: Promise<{ groupId: string; id: string }>;
}) {
  await requireUser();
  const { groupId, id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: col } = await supabase
    .from("recipe_collections")
    .select(
      "id, title, description, visibility, slug, group_id, recipe_collection_items(recipe_id, position, recipes(id, title))",
    )
    .eq("id", id)
    .eq("group_id", groupId)
    .maybeSingle();
  if (!col) notFound();
  const { data: all } = await supabase
    .from("recipes")
    .select("id, title")
    .eq("group_id", groupId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("title")
    .limit(300);
  const items = [...(col.recipe_collection_items ?? [])]
    .sort((a, b) => a.position - b.position)
    .flatMap((i) => (i.recipes ? [{ id: i.recipes.id, title: i.recipes.title }] : []));
  return (
    <CollectionManager
      groupId={groupId}
      collection={{
        id: col.id,
        title: col.title,
        description: col.description,
        slug: col.visibility === "public" ? col.slug : null,
      }}
      items={items}
      available={(all ?? []).filter((r) => !items.some((i) => i.id === r.id))}
    />
  );
}
