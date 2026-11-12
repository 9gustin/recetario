import { expect, test } from "@playwright/test";
import { createTestUser, mobileContext, signIn } from "./helpers/auth";
import { createGroupAs, seedRecipe } from "./helpers/recipes";

const password = "password123";

test("plan: armar la semana a mano, editar una comida y aprobar", async ({ browser }) => {
  test.setTimeout(120_000);
  const email = `plan-${Date.now()}@test.com`;
  await createTestUser(email, password, "Ana");
  const groupId = await createGroupAs(email, password, "Casa");
  await seedRecipe(email, password, groupId, {
    title: "Milanesas al horno",
    ingredients: ["4 milanesas", "2 papas"],
    steps: [{ instruction: "Horneá todo." }],
  });

  const page = await (await mobileContext(browser)).newPage();
  await signIn(page, email, password);
  await page.goto(`/g/${groupId}/plan`);

  // Sin plan: estado vacío con las tres opciones.
  await expect(page.getByText("Todavía no hay plan")).toBeVisible();
  await expect(page.getByRole("button", { name: /Armar con IA/ })).toBeDisabled();
  await page.getByRole("button", { name: /Armar a mano/ }).tap();
  await expect(page.getByText("Borrador", { exact: true })).toBeVisible();

  // Agregar una receta al primer día disponible.
  await page
    .getByRole("button", { name: /Agregar almuerzo/i })
    .first()
    .tap();
  await page.getByRole("button", { name: /Milanesas al horno/ }).tap();
  await expect(page.getByText("Milanesas al horno").first()).toBeVisible();

  // Agregar texto libre en la cena.
  await page
    .getByRole("button", { name: /Agregar cena/i })
    .first()
    .tap();
  await page.getByLabel("O escribí algo").fill("Comemos afuera");
  await page.getByRole("button", { name: "Agregar", exact: true }).tap();
  await expect(page.getByText("Comemos afuera")).toBeVisible();

  // Aprobar.
  await page.getByRole("button", { name: "Aprobar plan" }).tap();
  await expect(page.getByText("Aprobado", { exact: true })).toBeVisible();

  // Persiste al recargar.
  await page.reload();
  await expect(page.getByText("Aprobado", { exact: true })).toBeVisible();
  await expect(page.getByText("Milanesas al horno").first()).toBeVisible();
});

test("plan: duplicar una semana anterior desde el historial conserva las comidas", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const email = `plan-hist-${Date.now()}@test.com`;
  await createTestUser(email, password, "Ana");
  const groupId = await createGroupAs(email, password, "Casa");
  await seedRecipe(email, password, groupId, {
    title: "Guiso de lentejas",
    ingredients: ["2 tazas de lentejas"],
    steps: [{ instruction: "Cociná." }],
  });
  const page = await (await mobileContext(browser)).newPage();
  await signIn(page, email, password);
  await page.goto(`/g/${groupId}/plan`);
  await page.getByRole("button", { name: /Armar a mano/ }).tap();
  await page
    .getByRole("button", { name: /Agregar almuerzo/i })
    .first()
    .tap();
  await page.getByRole("button", { name: /Guiso de lentejas/ }).tap();
  await expect(page.getByText("Guiso de lentejas").first()).toBeVisible();

  await page.goto(`/g/${groupId}/plan/historial`);
  await page.getByRole("button", { name: "Repetir esta semana" }).first().tap();
  await expect(page.getByText("Guiso de lentejas").first()).toBeVisible();
  await expect(page.getByText("Borrador", { exact: true })).toBeVisible();
});
