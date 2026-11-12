import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string | undefined };

/** Una sola verificación por request (layout, página y acciones comparten el resultado). */
const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  // getClaims valida el JWT localmente (sin ir a la red de Auth en cada llamada); la RLS vuelve a validarlo en la base.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : undefined };
});

/** Devuelve el usuario autenticado o redirige a /login (Server Components y Actions). */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}
