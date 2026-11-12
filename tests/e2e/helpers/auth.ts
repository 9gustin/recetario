import type { Browser, BrowserContext, Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // En CI las variables ya vienen del entorno.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Cliente con service role para preparar datos en los tests (ignora RLS). */
export function adminClient() {
  return admin();
}

function admin() {
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY para los tests e2e",
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Crea un usuario (email + contraseña) con la API admin; dispara perfil + grupo personal. */
export async function createTestUser(
  email: string,
  password: string,
  name: string,
  opts: { onboarded?: boolean } = {},
): Promise<string> {
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: name },
  });
  if (error) throw error;
  // Los tests saltean el onboarding salvo que lo prueben a propósito.
  if (opts.onboarded !== false) {
    await admin()
      .from("profiles")
      .update({ onboarded_at: new Date().toISOString() })
      .eq("id", data.user.id);
  }
  return data.user.id;
}

/** Suma a alguien a un grupo (como si hubiera aceptado una invitación). */
export async function addMemberToGroup(groupId: string, userId: string) {
  const { error } = await admin()
    .from("group_members")
    .insert({ group_id: groupId, user_id: userId, role: "member" });
  if (error) throw error;
}

/** Devuelve el token de la invitación activa más reciente de un grupo. */
export async function getActiveInviteToken(groupId: string): Promise<string> {
  const { data, error } = await admin()
    .from("group_invites")
    .select("token")
    .eq("group_id", groupId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error || !data?.token) throw error ?? new Error("No hay invitación activa");
  return data.token;
}

/** Contexto mobile igual al del proyecto `mobile` de playwright.config.ts. */
export function mobileContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: "es-AR",
  });
}

/** Entra desde /login con email y contraseña; espera aterrizar en un grupo. */
export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.locator('form button[type="submit"]').tap();
  await page.waitForURL(/\/g\/.+\/hoy/);
}
