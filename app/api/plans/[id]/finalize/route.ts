import { NextResponse } from "next/server";
import { z } from "zod";
import { checkQuota } from "@/lib/ai/rate-limit";
import { sseResponse } from "@/lib/ai/stream";
import { runFinalize } from "@/lib/plans/finalize";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

const bodySchema = z.object({ only: z.array(z.string()).max(10).optional() });

/**
 * Pipeline posterior a la aprobación, en streaming y sin cola: lista de compras → consejos de compra → preparaciones.
 * Cada paso guarda su resultado al terminar; reintentar no duplica.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return NextResponse.json({ error: "Plan inválido." }, { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tenés que iniciar sesión." }, { status: 401 });

  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id, group_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!plan) return NextResponse.json({ error: "No encontramos el plan." }, { status: 404 });
  if (plan.status !== "approved")
    return NextResponse.json({ error: "Aprobá el plan primero." }, { status: 409 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  const only = parsed.success ? parsed.data.only : undefined;
  if (!(await checkQuota(user.id, "plan_chat")))
    return NextResponse.json({ error: "Llegaste al límite de hoy." }, { status: 429 });

  return sseResponse(async (emit) => {
    await runFinalize(
      { supabase, userId: user.id, groupId: plan.group_id, planId: plan.id, listIds: [] },
      emit,
      undefined,
      only,
    );
  });
}
