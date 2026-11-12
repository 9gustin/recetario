import { expect, test } from "@playwright/test";
import { createTestUser, mobileContext, signIn } from "./helpers/auth";

test("recetario: crear, buscar, escalar, editar, versiones, restaurar y aislamiento", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const run = Date.now();
  const password = "password123";
  const aEmail = `rec-a-${run}@test.com`;
  const bEmail = `rec-b-${run}@test.com`;
  await createTestUser(aEmail, password, "Ana");
  await createTestUser(bEmail, password, "Beto");

  const ctxA = await mobileContext(browser);
  const page = await ctxA.newPage();
  await signIn(page, aEmail, password);
  const groupId = page.url().split("/g/")[1]!.split("/")[0]!;

  // 1) Crear la receta pegando 5 líneas de ingredientes.
  await page.goto(`/g/${groupId}/recetas/nueva`);
  await page.getByLabel("Título").fill("Pollo al limón e2e");
  await page
    .getByLabel("Ingredientes")
    .fill(
      "2 pechugas de pollo\n1 limón\n2 cucharadas de aceite de oliva\n1 diente de ajo\nsal a gusto",
    );
  await page
    .getByPlaceholder("Qué hay que hacer en este paso")
    .first()
    .fill("Cociná el pollo 20 minutos.");
  await page.getByRole("button", { name: "Guardar" }).tap();
  await page.waitForURL(/\/recetas\/[0-9a-f-]{36}$/);
  const recipeUrl = page.url();
  await expect(page.getByRole("heading", { name: "Pollo al limón e2e" })).toBeVisible();

  // 2) Buscarla desde la lista.
  await page.goto(`/g/${groupId}/recetas`);
  await page.getByPlaceholder("Buscá por nombre o ingrediente").fill("limón");
  await expect(page.getByRole("link", { name: /Pollo al limón e2e/ })).toBeVisible();
  await page.getByPlaceholder("Buscá por nombre o ingrediente").fill("zzzz");
  await expect(page.getByText("No encontramos recetas")).toBeVisible();

  // 3) Escalar a 4 porciones.
  await page.goto(recipeUrl);
  await page.getByRole("button", { name: "Más porciones" }).tap();
  await page.getByRole("button", { name: "Más porciones" }).tap();
  await expect(page.getByText("4 porciones")).toBeVisible();

  // 4) Editar un paso → versión 2.
  await page.goto(`${recipeUrl}/editar`);
  await page
    .getByPlaceholder("Qué hay que hacer en este paso")
    .first()
    .fill("Cociná el pollo 25 minutos.");
  await page.getByLabel("¿Qué cambiaste? (opcional)").fill("más cocción");
  await page.getByRole("button", { name: "Guardar" }).tap();
  await page.waitForURL(recipeUrl);

  // 5) El historial muestra 2 versiones.
  await page.goto(`${recipeUrl}/historial`);
  await expect(page.getByText("Versión 2")).toBeVisible();
  await expect(page.getByText("Versión 1")).toBeVisible();
  await expect(page.getByText("más cocción")).toBeVisible();

  // 6) Restaurar la versión 1 crea una versión 3 (no borra historia).
  await page.getByText("Versión 1").tap();
  await page.getByRole("button", { name: "Volver a esta versión" }).tap();
  await page.getByRole("button", { name: "Sí, volver" }).tap();
  await page.waitForURL(recipeUrl);
  await expect(page.getByText("Cociná el pollo 20 minutos.")).toBeVisible();
  await page.goto(`${recipeUrl}/historial`);
  await expect(page.getByText("Versión 3")).toBeVisible();
  await expect(page.getByText("Restaurada la versión 1")).toBeVisible();
  await expect(page.getByText("Versión 2")).toBeVisible();

  // 7) Un usuario de otro grupo no la ve (404).
  const ctxB = await mobileContext(browser);
  const pageB = await ctxB.newPage();
  await signIn(pageB, bEmail, password);
  await pageB.goto(recipeUrl);
  await expect(
    pageB.getByRole("heading", { name: "No encontramos lo que buscabas" }),
  ).toBeVisible();
  await expect(pageB.getByText("Pollo al limón e2e")).toHaveCount(0);
});
