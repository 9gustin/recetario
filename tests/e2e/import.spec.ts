import { expect, test, type Page } from "@playwright/test";
import { createTestUser, mobileContext, signIn } from "./helpers/auth";

const password = "password123";

// 1x1 PNG transparente.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const DRAFT = {
  title: "Ñoquis de la nona",
  description: "La receta de la familia.",
  servings: 4,
  prep_minutes: null,
  cook_minutes: null,
  tags: ["pasta casera"],
  ingredients: [
    {
      raw_text: "1 kg de papa",
      quantity: 1,
      unit: "kg",
      name_canonical: "papa",
      position: 0,
      optional: false,
    },
    {
      raw_text: "300 g de harina",
      quantity: 300,
      unit: "g",
      name_canonical: "harina",
      position: 1,
      optional: false,
    },
    {
      raw_text: "1 puñado de couve",
      quantity: 1,
      unit: null,
      name_canonical: "couve",
      position: 2,
      optional: false,
    },
  ],
  steps: [
    {
      position: 0,
      instruction: "Hervir las papas con cáscara.",
      duration_seconds: 1800,
      timer_kind: "passive",
      tip: null,
    },
    {
      position: 1,
      instruction: "Pisarlas, mezclar con la harina y armar los ñoquis.",
      duration_seconds: null,
      timer_kind: null,
      tip: null,
    },
  ],
};

async function mockParse(
  page: Page,
  status = 200,
  body: unknown = { draft: DRAFT, newIngredients: ["couve"], via: "ai" },
) {
  await page.route("**/api/ai/recipes/parse", (route) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }),
  );
}

async function setup(browser: import("@playwright/test").Browser) {
  const email = `import-${Date.now()}-${Math.floor(Math.random() * 1e4)}@test.com`;
  await createTestUser(email, password, "Ana");
  const page = await (await mobileContext(browser)).newPage();
  await signIn(page, email, password);
  const groupId = page.url().split("/g/")[1]!.split("/")[0]!;
  return { page, groupId };
}

test("importar: pegar texto → borrador para revisar → guardar", async ({ browser }) => {
  test.setTimeout(120_000);
  const { page, groupId } = await setup(browser);
  await mockParse(page);

  await page.goto(`/g/${groupId}/recetas`);
  await page.getByRole("button", { name: "Agregar receta" }).tap();
  await page.getByRole("link", { name: "Pegar texto o link" }).tap();
  await expect(page.getByRole("heading", { name: "Pegar texto o link" })).toBeVisible();

  const arm = page.getByRole("button", { name: "Armar la receta" });
  await expect(arm).toBeDisabled();
  await page
    .getByLabel("Pegá la receta o un link")
    .fill("ñoquis de la nona: 1 kg de papa, 300 g de harina. Hervir las papas y armar.");
  await arm.tap();

  // Borrador precargado, con el aviso y el ingrediente nuevo resaltado.
  await expect(page.getByText("Revisá que esté todo bien antes de guardar.")).toBeVisible();
  await expect(page.getByLabel("Título")).toHaveValue("Ñoquis de la nona");
  await expect(page.getByText("ingrediente nuevo, revisalo")).toBeVisible();
  await expect(page.getByPlaceholder("Qué hay que hacer en este paso").first()).toHaveValue(
    "Hervir las papas con cáscara.",
  );

  await page.getByRole("button", { name: "Guardar" }).tap();
  await page.waitForURL(/\/recetas\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Ñoquis de la nona" })).toBeVisible();
});

test("importar: foto → sube y lee la receta", async ({ browser }) => {
  test.setTimeout(120_000);
  const { page, groupId } = await setup(browser);
  await mockParse(page);

  await page.goto(`/g/${groupId}/recetas/importar?modo=foto`);
  const read = page.getByRole("button", { name: "Leer la receta" });
  await expect(read).toBeDisabled();
  await page
    .getByLabel("Foto de la receta")
    .setInputFiles({ name: "cuaderno.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("1 foto lista")).toBeVisible();
  await read.tap();
  await expect(page.getByLabel("Título")).toHaveValue("Ñoquis de la nona");
});

test("importar: si no encuentra una receta, explica y ofrece cargarla a mano", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const { page, groupId } = await setup(browser);
  await mockParse(page, 422, {
    error: "No encontramos una receta en ese contenido.",
    code: "not_a_recipe",
  });

  await page.goto(`/g/${groupId}/recetas/importar?modo=texto`);
  await page
    .getByLabel("Pegá la receta o un link")
    .fill("Hoy fui al supermercado y compré leche, pan y detergente.");
  await page.getByRole("button", { name: "Armar la receta" }).tap();
  await expect(
    page.getByRole("alert").filter({ hasText: "No encontramos una receta" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
  await page.getByRole("link", { name: "Cargarla a mano" }).tap();
  await page.waitForURL(/\/recetas\/nueva$/);
});

test("importar: un modo inexistente da 404", async ({ browser }) => {
  const { page, groupId } = await setup(browser);
  await page.goto(`/g/${groupId}/recetas/importar?modo=otro`);
  await expect(page.getByRole("heading", { name: "No encontramos lo que buscabas" })).toBeVisible();
});
