import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/** Cliente sin sesión (rol anon): para páginas públicas, sin cookies. Solo ve lo que las RPC públicas devuelven. */
export function createAnonClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
