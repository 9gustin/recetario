import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMyGroups } from "@/lib/groups/queries";

// La raíz lleva al último grupo visitado (cookie) o al grupo personal.
export default async function Home() {
  // Sin sesión: la puerta de entrada es el buscador público.
  const { data: claims } = await (await createClient()).auth.getClaims();
  if (!claims?.claims?.sub) redirect("/explorar");
  const user = await requireUser();
  const cookieStore = await cookies();
  const lastGroupId = cookieStore.get("last_group_id")?.value;

  const groups = await getMyGroups(user.id);
  if (groups.length === 0) redirect("/perfil");

  const target =
    groups.find((g) => g.id === lastGroupId) ?? groups.find((g) => g.is_personal) ?? groups[0]!;

  redirect(`/g/${target.id}/hoy`);
}
