import { expect, test } from "@playwright/test";
import { createTestUser, getActiveInviteToken, mobileContext, signIn } from "./helpers/auth";

test("A crea Casa, invita a B y C no puede unirse tras revocar", async ({ browser }) => {
  const run = Date.now();
  const password = "password123";
  const aEmail = `a-${run}@test.com`;
  const bEmail = `b-${run}@test.com`;
  const cEmail = `c-${run}@test.com`;

  await createTestUser(aEmail, password, "A");
  await createTestUser(bEmail, password, "B");
  await createTestUser(cEmail, password, "C");

  const ctxA = await mobileContext(browser);
  const ctxB = await mobileContext(browser);
  const ctxC = await mobileContext(browser);
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  const pageC = await ctxC.newPage();

  // 1) A entra y crea el grupo "Casa".
  await signIn(pageA, aEmail, password);
  await pageA.getByRole("button", { name: "Cambiar de grupo" }).tap();
  await pageA.getByRole("link", { name: "Crear grupo" }).tap();
  await pageA.getByLabel("Nombre del grupo").fill("Casa");
  await pageA.getByRole("button", { name: "🏠" }).tap();
  await pageA.getByRole("button", { name: "Crear grupo" }).tap();
  await pageA.waitForURL(/\/g\/.+\/hoy/);

  const casaId = pageA.url().split("/g/")[1]!.split("/")[0]!;

  // 2) A genera un link de invitación desde los ajustes del grupo.
  await pageA.getByRole("button", { name: "Cambiar de grupo" }).tap();
  await pageA.getByRole("link", { name: "Administrar grupos" }).tap();
  await pageA.getByRole("link", { name: /Casa/ }).tap();
  await pageA.getByRole("button", { name: "Invitar" }).tap();
  await pageA.getByRole("button", { name: "Generar link" }).tap();
  await expect(pageA.getByText("Link de invitación")).toBeVisible();

  const token = await getActiveInviteToken(casaId);

  // 3) B abre el link, se loguea y se une.
  await pageB.goto(`/join/${token}`);
  await pageB.getByRole("link", { name: "Entrá para unirte" }).tap();
  await pageB.getByLabel("Email").fill(bEmail);
  await pageB.getByLabel("Contraseña").fill(password);
  await pageB.locator('form button[type="submit"]').tap();
  await pageB.waitForURL(`/join/${token}`);
  await pageB.getByRole("button", { name: "Unirme" }).tap();
  await pageB.waitForURL(/\/g\/.+\/hoy/);

  // 4) B ve "Casa" en el selector de grupos.
  await expect(pageB.getByRole("button", { name: "Cambiar de grupo" })).toContainText("Casa");

  // 5) A (recargando los ajustes) ve a B en los miembros.
  await pageA.reload();
  await expect(pageA.getByRole("paragraph").filter({ hasText: /^B$/ })).toBeVisible();

  // 6) A revoca la invitación.
  await pageA.getByRole("button", { name: "Invitar" }).tap();
  await pageA.getByRole("button", { name: "Revocar" }).tap();
  await expect(pageA.getByText("Todavía no generaste ningún link.")).toBeVisible();

  // 7) C no puede unirse con el link revocado.
  await pageC.goto(`/join/${token}`);
  await expect(pageC.getByText("Este link ya no está disponible")).toBeVisible();

  await ctxA.close();
  await ctxB.close();
  await ctxC.close();
});

test("contexto: desde Perfil, la barra inferior vuelve al último grupo y no al personal", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const { createTestUser, mobileContext, signIn } = await import("./helpers/auth");
  const { createGroupAs } = await import("./helpers/recipes");
  const email = `ctx-${Date.now()}@test.com`;
  await createTestUser(email, "password123", "Ana");
  const groupId = await createGroupAs(email, "password123", "Familia");
  const page = await (await mobileContext(browser)).newPage();
  await signIn(page, email, "password123");
  await page.goto(`/g/${groupId}/recetas`);
  await page.waitForLoadState("networkidle");
  await page.goto("/perfil");
  await expect(page.getByRole("button", { name: /Familia: cambiar de grupo/ })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(async () => {
    await page
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "Plan" })
      .tap({ timeout: 3000 });
    await expect(page).toHaveURL(new RegExp(`/g/${groupId}/plan`), { timeout: 5000 });
  }).toPass({ timeout: 30_000 });
});
