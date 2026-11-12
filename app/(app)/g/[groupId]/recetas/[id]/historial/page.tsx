import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getRecipe, getVersions } from "@/lib/recipes/queries";
import { diffSnapshots, parseSnapshot } from "@/lib/domain/recipe-diff";
import { DiffView } from "@/components/recipes/history/diff-view";
import { RestoreButton } from "@/components/recipes/history/restore-button";

export const metadata = { title: "Historial" };

const ORIGIN_LABELS: Record<string, string> = {
  edit: "Editada",
  cooking_session: "Mientras cocinabas",
  ai_adapt: "Adaptada con IA",
  restore: "Restaurada",
};

const dateFormat = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

export default async function Page({
  params,
}: {
  params: Promise<{ groupId: string; id: string }>;
}) {
  const user = await requireUser();
  const { groupId, id } = await params;
  const recipe = await getRecipe(id, user.id);
  if (!recipe || recipe.group_id !== groupId) notFound();

  const { data: versions } = await getVersions(id);

  return (
    <div className="flex flex-col gap-4 px-5 pt-2 pb-8">
      <Link
        href={`/g/${groupId}/recetas/${id}`}
        className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent"
      >
        <ChevronLeft className="size-4" aria-hidden="true" /> {recipe.title}
      </Link>
      <h2 className="font-display text-[28px] leading-none">Historial</h2>

      {versions.length === 0 ? (
        <p className="text-muted">Todavía no hay versiones guardadas.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {versions.map((v, idx) => {
            const previous = versions[idx + 1];
            const diff = diffSnapshots(
              previous ? parseSnapshot(previous.snapshot) : null,
              parseSnapshot(v.snapshot),
            );
            const isCurrent = v.version === recipe.current_version;
            return (
              <li key={v.id}>
                <details
                  open={idx === 0}
                  className="rounded-[20px] border border-border bg-surface p-4 [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex min-h-11 cursor-pointer flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-[15px] font-semibold">
                      Versión {v.version}
                      {isCurrent ? (
                        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent">
                          Actual
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-muted">
                      {dateFormat.format(new Date(v.created_at))} ·{" "}
                      {v.author_name ?? "Alguien del grupo"} · {ORIGIN_LABELS[v.origin] ?? v.origin}
                    </span>
                    {v.change_note ? <span className="text-sm">{v.change_note}</span> : null}
                  </summary>
                  <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
                    <DiffView diff={diff} initial={!previous} />
                    {!isCurrent ? (
                      <RestoreButton groupId={groupId} recipeId={id} version={v.version} />
                    ) : null}
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
