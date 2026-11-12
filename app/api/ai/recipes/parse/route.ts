import { NextResponse } from "next/server";
import { parseRecipe, type ParseErrorCode } from "@/lib/ai/recipes/parse";
import { checkQuota } from "@/lib/ai/rate-limit";
import { parseRecipeRequestSchema } from "@/lib/schemas/parse-recipe-request";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const STATUS: Record<ParseErrorCode, number> = {
  too_short: 400,
  bad_image: 400,
  not_a_recipe: 422,
  fetch_failed: 422,
  ai_failed: 502,
};

/** Estructura una receta (texto, link, fotos o dictado) y devuelve un borrador. No guarda nada. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tenés que iniciar sesión." }, { status: 401 });

  const parsed = parseRecipeRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Los datos no son válidos." }, { status: 400 });
  const { groupId, source } = parsed.data;

  // El grupo lo verifica el servidor: no se confía en lo que manda el cliente.
  const { data: member } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "No encontramos el grupo." }, { status: 404 });

  if (!(await checkQuota(user.id, "parse_recipe"))) {
    return NextResponse.json(
      { error: "Llegaste al límite de recetas importadas de hoy. Probá mañana." },
      { status: 429 },
    );
  }

  const result = await parseRecipe(source, { userId: user.id, groupId });
  if (!result.ok)
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: STATUS[result.code] },
    );
  return NextResponse.json(result.data);
}
