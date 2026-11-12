/**
 * Crea códigos de invitación para nutricionistas.
 *
 *   pnpm pro:invite                          # 1 código de 1 uso (base local, .env.local)
 *   pnpm pro:invite "Lic. Ana Pérez" 3 30    # nota, usos máximos, días de vigencia
 *   CATALOG_ENV_FILE=.env.prod pnpm pro:invite "Lic. Ana Pérez"   # base de producción
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(process.env.CATALOG_ENV_FILE ?? ".env.local");

const [note, uses, days] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");

async function main() {
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const code = `PRO-${randomBytes(4).toString("hex").toUpperCase()}`;
  const { error } = await supabase.from("professional_invites").insert({
    code,
    note: note ?? null,
    max_uses: Number(uses ?? 1),
    expires_at: days ? new Date(Date.now() + Number(days) * 86_400_000).toISOString() : null,
  });
  if (error) throw error;
  console.log(`Código creado: ${code}`);
  console.log('Se canjea en /profesionales (botón "Tengo un código").');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
