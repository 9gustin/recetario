import { NextResponse } from "next/server";
import { checkQuota } from "@/lib/ai/rate-limit";
import { ingestFoodProfile } from "@/lib/ai/food-profile/ingest";
import { ingestRequestSchema } from "@/lib/schemas/food-profile-requests";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/** Convierte lo que la persona cuenta (texto, dictado, archivos, respuestas) en un borrador de perfil alimentario. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tenés que iniciar sesión." }, { status: 401 });

  const parsed = ingestRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Los datos no son válidos." },
      { status: 400 },
    );
  }
  if (!(await checkQuota(user.id, "food_profile"))) {
    return NextResponse.json(
      { error: "Llegaste al límite de hoy. Probá mañana." },
      { status: 429 },
    );
  }

  const result = await ingestFoodProfile(supabase, user.id, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data);
}
