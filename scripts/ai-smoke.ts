/**
 * Prueba de humo de la IA: llama a `runStructured` con un esquema mínimo contra la API real
 * y muestra la fila resultante en `ai_runs`. Usa un usuario temporal que se borra al final.
 *
 *   pnpm ai:smoke
 */
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

process.loadEnvFile(".env.local");

async function main() {
  const { runStructured } = await import("../lib/ai/run-structured");
  const { MODELS } = await import("../lib/ai/models");

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const email = `ai-smoke-${Date.now()}@test.com`;
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: "password123",
    email_confirm: true,
  });
  if (error || !created.user) throw error ?? new Error("No se pudo crear el usuario de prueba");

  try {
    const res = await runStructured({
      feature: "smoke",
      model: MODELS.fast,
      system: "Sos un asistente de cocina argentino. Respondé siempre usando la herramienta.",
      content: "Dame un saludo corto y el nombre de un plato típico argentino.",
      schema: z.object({ saludo: z.string(), plato: z.string() }),
      userId: created.user.id,
      maxTokens: 200,
    });
    console.log("Resultado:", JSON.stringify(res));
    const { data: runs } = await admin.from("ai_runs").select("*").eq("user_id", created.user.id);
    console.log("ai_runs:", JSON.stringify(runs, null, 2));
    if (!res.ok || !runs?.length) process.exitCode = 1;
  } finally {
    await admin.auth.admin.deleteUser(created.user.id);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
