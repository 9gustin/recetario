import { requireUser } from "@/lib/auth";
import { CreateGroupForm } from "@/components/groups/create-group-form";

export const metadata = { title: "Crear grupo" };

export default async function Page() {
  await requireUser();
  return (
    <main className="flex flex-col gap-5 px-5 pt-5">
      <h1 className="font-display text-[34px] leading-none font-normal">Crear grupo</h1>
      <CreateGroupForm />
    </main>
  );
}
