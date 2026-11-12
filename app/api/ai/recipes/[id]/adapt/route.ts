import { NextResponse } from "next/server";
import { checkQuota } from "@/lib/ai/rate-limit";
import { adaptRecipe } from "@/lib/ai/recipes/adapt";
import { adaptRequestSchema } from "@/lib/schemas/adapt-recipe";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/** Adapta una receta a las restricciones de las personas elegidas y devuelve el borrador de la variante. No guarda nada. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tenés que iniciar sesión." }, { status: 401 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return NextResponse.json({ error: "Receta inválida." }, { status: 400 });
  const parsed = adaptRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Elegí al menos una persona." }, { status: 400 });

  if (!(await checkQuota(user.id, "parse_recipe"))) {
    return NextResponse.json(
      { error: "Llegaste al límite de hoy. Probá mañana." },
      { status: 429 },
    );
  }

  const result = await adaptRecipe({
    recipeId: id,
    memberIds: parsed.data.memberIds,
    userId: user.id,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({
    draft: result.data.draft,
    changes: result.data.changes,
    titleSuffix: result.data.titleSuffix,
    compat: result.data.compat.map((m) => ({
      userId: m.userId,
      name: m.displayName,
      status: m.status,
    })),
  });
}
