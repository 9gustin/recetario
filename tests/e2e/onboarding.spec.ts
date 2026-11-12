import { expect, test } from "@playwright/test";
import { createTestUser, mobileContext } from "./helpers/auth";

test("onboarding: una cuenta nueva ve las 3 pantallas, las saltea y queda el checklist en Hoy", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const email = `onb-${Date.now()}@test.com`;
  await createTestUser(email, "password123", "Ana", { onboarded: false });
  const page = await (await mobileContext(browser)).newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill("password123");
  await page.locator('form button[type="submit"]').tap();

  await expect(page).toHaveURL(/\/bienvenida$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "¿Con quién cocinás?" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(async () => {
    await page.getByRole("button", { name: "Más tarde" }).tap({ timeout: 2000 });
    await expect(
      page.getByRole("heading", { name: "Cargá 3 recetas que hacen siempre" }),
    ).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
  await page.getByRole("button", { name: "Más tarde" }).tap();
  await expect(page.getByRole("heading", { name: "Contanos cómo comen" })).toBeVisible();
  await page.getByRole("button", { name: "Entrar a la app" }).tap();

  await expect(page).toHaveURL(/\/g\/[^/]+\/hoy$/, { timeout: 20_000 });
  await expect(page.getByRole("region", { name: "Para arrancar" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cargar tu primera receta" })).toBeVisible();
});
