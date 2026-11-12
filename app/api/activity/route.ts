import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({ path: z.string().max(300), groupId: z.string().uuid().optional() });

/** Navegación: la manda el cliente con sendBeacon en cada cambio de pantalla. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 204 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 204 });
  await supabase.from("activity_events").insert({
    user_id: user.id,
    group_id: parsed.data.groupId ?? null,
    kind: "page_view",
    path: parsed.data.path,
  });
  return new NextResponse(null, { status: 204 });
}
