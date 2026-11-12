import type { Metadata } from "next";
import Link from "next/link";
import { RecipeGridCard } from "@/components/public/recipe-grid-card";
import { BRAND } from "@/lib/brand";
import { PAGE_SIZE, searchPublic } from "@/lib/public/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Explorar recetas",
  description: `Recetas rápidas y caseras, en español: buscá por ingrediente, tiempo o tipo de comida. ${BRAND.tagline}.`,
};

const TIMES = [15, 30, 45];
const TAGS = [
  "rápido",
  "desayuno",
  "cena",
  "vegetariano",
  "sin gluten",
  "liviano",
  "económico",
  "pollo",
  "pasta",
  "postre",
  "airfryer",
  "para freezar",
];
const SOURCES = [
  { key: "all", label: "Todas" },
  { key: "community", label: "Comunidad" },
  { key: "catalog", label: "Catálogo" },
] as const;

type Search = { q?: string; min?: string; tag?: string; src?: string; p?: string };

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const source = SOURCES.some((s) => s.key === sp.src)
    ? (sp.src as "all" | "catalog" | "community")
    : "all";
  const maxMinutes = TIMES.includes(Number(sp.min)) ? Number(sp.min) : undefined;
  const page = Math.max(1, Number(sp.p) || 1);
  const { cards, total } = await searchPublic({ q: sp.q, maxMinutes, tag: sp.tag, source, page });

  const href = (over: Partial<Search>) => {
    const next = { ...sp, ...over };
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) qs.set(k, String(v));
    const s = qs.toString();
    return `/explorar${s ? `?${s}` : ""}`;
  };
  const chip = (active: boolean) =>
    cn(
      "flex min-h-11 flex-none items-center rounded-full border px-3.5 text-[13px] font-semibold",
      active ? "border-foreground bg-foreground text-background" : "border-border bg-surface",
    );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 py-5">
      <h1 className="font-display text-[32px] leading-[1.05] font-normal">Explorar recetas</h1>

      <form action="/explorar" method="get" role="search" className="flex gap-2">
        <label htmlFor="q" className="sr-only">
          Buscar recetas
        </label>
        <input
          id="q"
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Pollo, zapallitos, tarta…"
          className="min-h-12 min-w-0 flex-1 rounded-full border border-border bg-surface px-4 text-[15px] outline-none"
        />
        {maxMinutes ? <input type="hidden" name="min" value={maxMinutes} /> : null}
        {sp.tag ? <input type="hidden" name="tag" value={sp.tag} /> : null}
        {source !== "all" ? <input type="hidden" name="src" value={source} /> : null}
        <button
          type="submit"
          className="min-h-12 rounded-full bg-accent px-5 text-[15px] font-bold text-accent-foreground"
        >
          Buscar
        </button>
      </form>

      <div className="flex flex-col gap-2" aria-label="Filtros">
        <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Origen">
          {SOURCES.map((s) => (
            <Link
              key={s.key}
              href={href({ src: s.key === "all" ? undefined : s.key, p: undefined })}
              className={chip(source === s.key)}
              aria-current={source === s.key ? "true" : undefined}
            >
              {s.label}
            </Link>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Tiempo">
          {TIMES.map((t) => (
            <Link
              key={t}
              href={href({ min: maxMinutes === t ? undefined : String(t), p: undefined })}
              className={chip(maxMinutes === t)}
            >
              Menos de {t} min
            </Link>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Tipo">
          {TAGS.map((t) => (
            <Link
              key={t}
              href={href({ tag: sp.tag === t ? undefined : t, p: undefined })}
              className={chip(sp.tag === t)}
            >
              {t}
            </Link>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted" role="status">
        {total === 0
          ? "No encontramos recetas con esa búsqueda."
          : `${total} ${total === 1 ? "receta" : "recetas"}`}
      </p>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Recetas">
        {cards.map((c) => (
          <RecipeGridCard key={c.id} recipe={c} />
        ))}
      </ul>

      {total > page * PAGE_SIZE ? (
        <Link
          href={href({ p: String(page + 1) })}
          className="mx-auto flex min-h-12 items-center rounded-full border border-border px-6 font-semibold"
        >
          Ver más
        </Link>
      ) : null}
    </div>
  );
}
