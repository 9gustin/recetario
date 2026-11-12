import { NextResponse } from "next/server";
import { checkQuota } from "@/lib/ai/rate-limit";
import { suggestFromPantry } from "@/lib/ai/suggest/suggest";
import { suggestRequestSchema } from "@/lib/schemas/suggest";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/** Sugerencias para hoy: "¿Qué tenés?" (modo have). Las recetas nuevas quedan en borrador. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tenés que iniciar sesión." }, { status: 401 });

  const parsed = suggestRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Los datos no son válidos." }, { status: 400 });
  const body = parsed.data;

  const { data: member } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("group_id", body.groupId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "No encontramos el grupo." }, { status: 404 });

  if (!(await checkQuota(user.id, "ideas"))) {
    return NextResponse.json(
      { error: "Llegaste al límite de sugerencias de hoy. Probá mañana." },
      { status: 429 },
    );
  }

  const result = await suggestFromPantry({
    supabase,
    userId: user.id,
    groupId: body.groupId,
    have: body.have,
    craving: body.craving,
    filters: body.filters,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ cards: result.cards });
}
