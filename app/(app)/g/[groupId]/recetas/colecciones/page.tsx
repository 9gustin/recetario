import Link from "next/link";
import { CreateCollection } from "@/components/collections/create-collection";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Colecciones" };

export default async function Page({ params }: { params: Promise<{ groupId: string }> }) {
  await requireUser();
  const { groupId } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("recipe_collections")
    .select("id, title, visibility, recipe_collection_items(recipe_id)")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  return (
    <div className="flex flex-col gap-4 px-5 pt-2 pb-8">
      <h2 className="font-display text-[28px] leading-[1.05] font-normal">Colecciones</h2>
      <p className="text-sm text-muted">
        Agrupá recetas (por ejemplo «Cenas de 20 minutos») y, si querés, hacelas públicas con un
        link.
      </p>
      <CreateCollection groupId={groupId} />
      <ul className="flex flex-col gap-2" aria-label="Mis colecciones">
        {(data ?? []).map((c) => (
          <li key={c.id}>
            <Link
              href={`/g/${groupId}/recetas/colecciones/${c.id}`}
              className="flex min-h-14 items-center justify-between rounded-2xl bg-surface px-4"
            >
              <span className="text-[15px] font-semibold">{c.title}</span>
              <span className="text-xs text-muted">
                {(c.recipe_collection_items ?? []).length} recetas ·{" "}
                {c.visibility === "public" ? "Pública" : "Privada"}
              </span>
            </Link>
          </li>
        ))}
        {(data ?? []).length === 0 ? (
          <li className="text-sm text-muted">Todavía no hay colecciones.</li>
        ) : null}
      </ul>
    </div>
  );
}
