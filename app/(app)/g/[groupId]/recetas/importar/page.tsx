import { notFound } from "next/navigation";
import { ImportFlow, type ImportMode } from "@/components/recipes/import/import-flow";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Importar receta" };

const TITLES: Record<ImportMode, string> = {
  texto: "Pegar texto o link",
  foto: "Sacarle foto",
  dictar: "Dictarla",
};

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ modo?: string }>;
}) {
  await requireUser();
  const [{ groupId }, { modo }] = await Promise.all([params, searchParams]);
  if (modo !== "texto" && modo !== "foto" && modo !== "dictar") notFound();

  return (
    <main className="flex flex-col gap-5 px-5 pt-5 pb-8">
      <h1 className="font-display text-[34px] leading-none font-normal">{TITLES[modo]}</h1>
      <ImportFlow groupId={groupId} mode={modo} />
    </main>
  );
}
