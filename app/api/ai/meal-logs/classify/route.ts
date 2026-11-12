import { NextResponse } from "next/server";
import { z } from "zod";
import { MODELS } from "@/lib/ai/models";
import { checkQuota } from "@/lib/ai/rate-limit";
import { runStructured } from "@/lib/ai/run-structured";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

const bodySchema = z.object({
  text: z.string().trim().min(2).max(500),
  formula: z.string().trim().max(300).optional(),
});
const outSchema = z.object({
  status: z.enum(["followed", "changed", "allowance"]),
  phrase: z.string().max(160),
});

const SYSTEM = `Clasificás lo que una persona comió contra la fórmula de su plan de alimentación. followed = cumplió la fórmula; changed = cambió algo pero sigue la idea; allowance = fue un permitido o comida libre (algo que sale de la fórmula). Devolvé status y una frase corta en voseo que explique por qué ("Es una comida libre: sale de la fórmula"). No juzgues ni des consejos médicos.`;

/** Sugiere el estado de una comida a partir de lo que la persona cuenta; ella confirma. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tenés que iniciar sesión." }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Contame qué comiste." }, { status: 400 });
  if (!(await checkQuota(user.id, "ideas")))
    return NextResponse.json({ error: "Llegaste al límite de hoy." }, { status: 429 });

  const run = await runStructured({
    feature: "ideas",
    model: MODELS.fast,
    system: SYSTEM,
    content: `Fórmula del plan: ${parsed.data.formula || "(no se indicó)"}\nLo que comió: ${parsed.data.text}`,
    schema: outSchema,
    userId: user.id,
    maxTokens: 300,
  });
  if (!run.ok)
    return NextResponse.json({ error: "No pudimos sugerir un estado." }, { status: 502 });
  return NextResponse.json(run.data);
}
