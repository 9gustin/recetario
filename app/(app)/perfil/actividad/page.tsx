import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Actividad" };

const LABEL: Record<string, string> = {
  page_view: "Abriste",
  login: "Iniciaste sesión",
  plan_approved: "Aprobaste un plan",
  shopping_list_generated: "Se armó la lista de compras",
  cooking_finished: "Terminaste de cocinar",
  recipe_saved: "Guardaste una receta",
  recipe_published: "Publicaste una receta",
  ai_error: "Falló una consulta a la IA",
  chat_question: "Preguntaste en el chat",
};

const fmt = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

export default async function Page() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_events")
    .select("id, kind, path, meta, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(150);
  return (
    <main className="flex flex-col gap-4 px-5 pt-5 pb-8">
      <h1 className="font-display text-[28px] leading-[1.05] font-normal">Actividad</h1>
      <p className="text-sm text-muted">
        Lo que hiciste en la app en los últimos 90 días. Es privado: solo lo ves vos.
      </p>
      <ul className="flex flex-col gap-1.5" aria-label="Movimientos">
        {(data ?? []).map((e) => (
          <li
            key={e.id}
            className="flex items-baseline justify-between gap-3 rounded-2xl bg-surface px-4 py-2.5 text-sm"
          >
            <span className="min-w-0 truncate">
              {LABEL[e.kind] ?? e.kind}
              {e.path ? <span className="text-muted"> · {e.path}</span> : null}
            </span>
            <time className="flex-none text-xs text-muted" dateTime={e.created_at}>
              {fmt.format(new Date(e.created_at))}
            </time>
          </li>
        ))}
        {(data ?? []).length === 0 ? (
          <li className="text-sm text-muted">Todavía no hay movimientos.</li>
        ) : null}
      </ul>
    </main>
  );
}
