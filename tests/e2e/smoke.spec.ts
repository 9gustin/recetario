import { expect, test } from "@playwright/test";

test("sin sesión, las pantallas privadas redirigen al login", async ({ page }) => {
  await page.goto("/perfil");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Las recetas de tu casa" })).toBeVisible();
});
