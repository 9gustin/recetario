import { NextResponse } from "next/server";
import { foodProfileDataSchema, mergeProfiles } from "@/lib/schemas/food-profile";
import { applyRequestSchema } from "@/lib/schemas/food-profile-requests";
import { createClient } from "@/lib/supabase/server";

/** Guarda el borrador (con las ediciones de la persona) como su perfil alimentario: versión + 1. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tenés que iniciar sesión." }, { status: 401 });

  const parsed = applyRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Los datos no son válidos." }, { status: 400 });
  const { draftId, edits } = parsed.data;

  const { data: draft } = await supabase
    .from("food_profile_drafts")
    .select("id, proposed, summary, input_ids")
    .eq("id", draftId)
    .eq("status", "pending")
    .maybeSingle();
  if (!draft) return NextResponse.json({ error: "No encontramos ese borrador." }, { status: 404 });

  const proposed = foodProfileDataSchema.safeParse(draft.proposed);
  if (!proposed.success)
    return NextResponse.json({ error: "El borrador no es válido." }, { status: 422 });
  const data = mergeProfiles(proposed.data, edits?.profile ?? {});

  const { data: existing } = await supabase
    .from("food_profiles")
    .select("version")
    .eq("user_id", user.id)
    .maybeSingle();
  const version = (existing?.version ?? 0) + 1;
  const { error } = await supabase.from("food_profiles").upsert({
    user_id: user.id,
    summary: edits?.summary ?? draft.summary,
    data,
    version,
    valid_until: data.valid_until,
  });
  if (error) return NextResponse.json({ error: "No pudimos guardar el perfil." }, { status: 500 });

  const now = new Date().toISOString();
  await supabase.from("food_profile_drafts").update({ status: "applied" }).eq("id", draft.id);
  if (draft.input_ids.length)
    await supabase
      .from("food_profile_inputs")
      .update({ processed_at: now })
      .in("id", draft.input_ids);
  return NextResponse.json({ version, profile: data });
}
