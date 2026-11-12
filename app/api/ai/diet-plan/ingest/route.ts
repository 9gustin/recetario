import { NextResponse } from "next/server";
import { dietIngestSchema, ingestDietPlan } from "@/lib/ai/diet-plan/ingest";
import { checkQuota } from "@/lib/ai/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

/** Digitaliza el plan de la nutricionista (PDF, foto, dictado o texto) y lo guarda como borrador. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tenés que iniciar sesión." }, { status: 401 });

  const parsed = dietIngestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Los datos no son válidos." },
      { status: 400 },
    );
  if (!(await checkQuota(user.id, "food_profile")))
    return NextResponse.json(
      { error: "Llegaste al límite de hoy. Probá mañana." },
      { status: 429 },
    );

  const result = await ingestDietPlan(supabase, user.id, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data);
}
