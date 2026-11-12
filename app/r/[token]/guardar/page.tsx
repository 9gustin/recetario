import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SavePublicRecipe } from "@/components/recipes/save-public-recipe";
import { UnavailableRecipe } from "@/components/recipes/unavailable-recipe";
import { getMyGroups } from "@/lib/groups/queries";
import { getPublicRecipe } from "@/lib/recipes/public";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Guardar receta",
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const recipe = await getPublicRecipe(token);
  if (!recipe) return <UnavailableRecipe />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Sin sesión: se entra (o se crea la cuenta) y se vuelve acá.
  if (!user) redirect(`/login?next=${encodeURIComponent(`/r/${token}/guardar`)}`);

  const groups = await getMyGroups(user.id);
  return (
    <SavePublicRecipe
      token={token}
      title={recipe.title}
      groups={groups.map((g) => ({
        id: g.id,
        name: g.name,
        emoji: g.emoji,
        is_personal: g.is_personal,
      }))}
    />
  );
}
