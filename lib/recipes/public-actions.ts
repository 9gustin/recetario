"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { TOKEN_PATTERN } from "@/lib/schemas/public-recipe";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  token: z.string().regex(TOKEN_PATTERN),
  targetGroupId: z.string().uuid(),
});

/** Guarda en uno de mis grupos una receta que llegó por link público. */
export async function savePublicRecipe(
  raw: unknown,
): Promise<
  { ok: true; data: { recipeId: string; groupId: string } } | { ok: false; error: string }
> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fork_public_recipe", {
    p_token: parsed.data.token,
    p_target_group_id: parsed.data.targetGroupId,
  });
  if (error || !data)
    return {
      ok: false,
      error: "No se pudo guardar la receta. Puede que el link ya no esté disponible.",
    };
  revalidatePath(`/g/${parsed.data.targetGroupId}/recetas`);
  return { ok: true, data: { recipeId: data, groupId: parsed.data.targetGroupId } };
}
