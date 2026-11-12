import { expect, test } from "@playwright/test";
import { addMemberToGroup, createTestUser, mobileContext, signIn } from "./helpers/auth";
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

test("plan: los cambios de otra persona aparecen en vivo", async ({ browser }) => {
  test.setTimeout(120_000);
  const run = Date.now();
  const aEmail = `plan-rt-a-${run}@test.com`;
  const bEmail = `plan-rt-b-${run}@test.com`;
  await createTestUser(aEmail, password, "Ana");
  const bId = await createTestUser(bEmail, password, "Beto");
  const groupId = await createGroupAs(aEmail, password, "Casa");
  await addMemberToGroup(groupId, bId);
  await seedRecipe(aEmail, password, groupId, {
    title: "Tarta de zapallitos",
    ingredients: ["2 zapallitos"],
    steps: [{ instruction: "Horneá." }],
  });

  const pageA = await (await mobileContext(browser)).newPage();
  await signIn(pageA, aEmail, password);
  await pageA.goto(`/g/${groupId}/plan`);
  await pageA.getByRole("button", { name: /Armar a mano/ }).tap();
  await expect(pageA.getByText("Borrador", { exact: true })).toBeVisible();

  const pageB = await (await mobileContext(browser)).newPage();
  await signIn(pageB, bEmail, password);
  await pageB.goto(`/g/${groupId}/plan`);
  await expect(pageB.getByText("Borrador", { exact: true })).toBeVisible();
  await expect(pageB.getByText("Ana está viendo este plan")).toBeVisible();

  await pageA
    .getByRole("button", { name: /Agregar almuerzo/i })
    .first()
    .tap();
  await pageA.getByRole("button", { name: /Tarta de zapallitos/ }).tap();
  await expect(pageB.getByText("Tarta de zapallitos").first()).toBeVisible();
});
