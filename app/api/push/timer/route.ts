import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  key: z.string().min(1).max(120),
  fireAt: z.string().datetime(),
  title: z.string().min(1).max(120),
  url: z.string().max(300).optional(),
});

/** Programa el aviso de un timer de cocina para cuando la app esté en segundo plano. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tenés que iniciar sesión." }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  const { error } = await supabase.from("scheduled_pushes").upsert(
    {
      user_id: user.id,
      key: parsed.data.key,
      kind: "timer",
      fire_at: parsed.data.fireAt,
      title: parsed.data.title,
      body: "Tu timer terminó.",
      url: parsed.data.url ?? null,
      sent_at: null,
    },
    { onConflict: "user_id,key" },
  );
  if (error) return NextResponse.json({ error: "No se pudo programar." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tenés que iniciar sesión." }, { status: 401 });
  const parsed = z
    .object({ key: z.string().min(1).max(120) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  await supabase.from("scheduled_pushes").delete().eq("key", parsed.data.key).is("sent_at", null);
  return NextResponse.json({ ok: true });
}
