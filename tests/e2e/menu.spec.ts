import { expect, test } from "@playwright/test";
import { createTestUser, mobileContext, signIn } from "./helpers/auth";
import { createGroupAs, seedRecipe } from "./helpers/recipes";

const password = "password123";

test("mis comidas: anotar comidas sin día, repetirlas y ver las compras", async ({ browser }) => {
  test.setTimeout(120_000);
  const email = `menu-${Date.now()}@test.com`;
  await createTestUser(email, password, "Ana");
  const groupId = await createGroupAs(email, password, "Casa");
  await seedRecipe(email, password, groupId, {
    title: "Tarta de pollo",
    ingredients: ["500 g de pollo", "2 huevos", "1 cebolla"],
    steps: [{ instruction: "Horneá." }],
  });

  const page = await (await mobileContext(browser)).newPage();
  await signIn(page, email, password);
  await page.goto(`/g/${groupId}/plan`);

  await expect(page.getByRole("heading", { name: "Mis comidas" })).toBeVisible();
  await expect(page.getByText("Todavía no anotaste comidas")).toBeVisible();

  // Una receta del recetario y una comida escrita a mano, sin día ni momento.
  await page
    .getByRole("button", { name: /Agregar comida/ })
    .first()
    .tap();
  await page
    .getByRole("button", { name: /Tarta de pollo/ })
    .first()
    .tap();
  await expect(
    page.getByRole("list", { name: "Comidas" }).getByText("Tarta de pollo"),
  ).toBeVisible();

  await page
    .getByRole("button", { name: /Agregar comida/ })
    .first()
    .tap();
  await page.getByLabel("O escribí algo").fill("Ensalada de la abuela");
  await page.getByRole("button", { name: "Agregar", exact: true }).tap();
  await expect(page.getByText("Ensalada de la abuela")).toBeVisible();

  // Cantidad: la tarta se hace 3 veces y las compras se multiplican.
  await page.getByRole("button", { name: "Más Tarta de pollo" }).tap();
  await page.getByRole("button", { name: "Más Tarta de pollo" }).tap();
  await expect(page.getByLabel("3 veces")).toBeVisible();
  await expect(page.getByRole("region", { name: "Qué comprar" })).toBeVisible();

  // Todo se guardó solo: no hay "Aprobar".
  await expect(page.getByRole("button", { name: "Aprobar plan" })).toHaveCount(0);
  await page.waitForLoadState("networkidle");
  await page.reload();
  await expect(page.getByText("Tarta de pollo").first()).toBeVisible();
  await expect(page.getByLabel("3 veces")).toBeVisible();

  // Tildar como cocinada.
  await page
    .getByRole("button", { name: /como cocinada/ })
    .first()
    .tap();
  await expect(page.getByRole("button", { name: /como pendiente/ })).toBeVisible();
});
