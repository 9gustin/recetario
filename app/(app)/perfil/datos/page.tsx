import { DeleteAccount } from "@/components/account/delete-account";
import { PillButton } from "@/components/shared/pill-button";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Mis datos" };

export default async function Page() {
  await requireUser();
  return (
    <main className="flex flex-col gap-5 px-5 pt-5 pb-8">
      <h1 className="font-display text-[28px] leading-[1.05] font-normal">Mis datos</h1>
      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-semibold">Exportar</h2>
        <p className="text-sm text-muted">
          Descargá un archivo con tus recetas, tu perfil alimentario, tus planes y tus registros.
        </p>
        <PillButton asChild variant="soft">
          <a href="/api/account/export" download>
            Descargar mis datos
          </a>
        </PillButton>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-semibold">Borrar cuenta</h2>
        <DeleteAccount />
      </section>
    </main>
  );
}
