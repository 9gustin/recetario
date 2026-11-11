import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Health check: la app responde y la base de datos contesta un ping. */
export async function GET() {
  let db = false;
  try {
    const { error } = await createAdminClient().auth.admin.listUsers({ page: 1, perPage: 1 });
    db = !error;
  } catch {
    db = false;
  }
  return NextResponse.json({ ok: true, db }, { status: db ? 200 : 503 });
}
