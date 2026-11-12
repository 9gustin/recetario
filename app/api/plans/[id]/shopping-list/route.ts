import { NextResponse } from "next/server";
import { generateShoppingLists } from "@/lib/shopping/generate";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/** Genera o regenera la lista de compras de un plan (la RLS limita a planes del grupo). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return NextResponse.json({ error: "Plan inválido." }, { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tenés que iniciar sesión." }, { status: 401 });
  const result = await generateShoppingLists(supabase, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json({ listIds: result.listIds });
}
