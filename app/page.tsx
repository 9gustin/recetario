import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { getMyGroups } from "@/lib/groups/queries";

// La raíz lleva al último grupo visitado (cookie) o al grupo personal.
export default async function Home() {
  const user = await requireUser();
  const cookieStore = await cookies();
  const lastGroupId = cookieStore.get("last_group_id")?.value;

  const groups = await getMyGroups(user.id);
  if (groups.length === 0) redirect("/perfil");

  const target =
    groups.find((g) => g.id === lastGroupId) ??
    groups.find((g) => g.is_personal) ??
    groups[0]!;

  redirect(`/g/${target.id}/hoy`);
}
