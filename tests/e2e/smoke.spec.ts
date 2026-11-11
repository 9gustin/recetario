import { expect, test } from "@playwright/test";

test("abre la app, ve la barra inferior y navega a Recetas", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/g\/demo\/hoy$/);

  const nav = page.getByRole("navigation", { name: "Principal" });
  await expect(nav.getByRole("link")).toHaveCount(5);

  await nav.getByRole("link", { name: "Recetas" }).tap();
  await expect(page).toHaveURL(/\/g\/demo\/recetas$/);
  await expect(page.getByRole("heading", { name: "Todavía no hay recetas" })).toBeVisible();
});
