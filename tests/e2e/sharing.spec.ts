import { expect, test } from "@playwright/test";
import { addMemberToGroup, createTestUser, mobileContext, signIn } from "./helpers/auth";
import { createGroupAs, seedRecipe } from "./helpers/recipes";

const password = "password123";

test("compartir: link público, guardar desde un link, revocar, copiar a otro grupo y mandar a una persona", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const run = Date.now();
  const aEmail = `share-a-${run}@test.com`;
  const bEmail = `share-b-${run}@test.com`;
  const cEmail = `share-c-${run}@test.com`;
  await createTestUser(aEmail, password, "Ana");
  const bId = await createTestUser(bEmail, password, "Beto");
  await createTestUser(cEmail, password, "Cami");

  const ctxA = await mobileContext(browser);
  const pageA = await ctxA.newPage();
  await signIn(pageA, aEmail, password);
  const groupId = pageA.url().split("/g/")[1]!.split("/")[0]!;
  const recipeId = await seedRecipe(aEmail, password, groupId, {
    title: "Pollo al limón compartido",
    ingredients: ["2 pechugas de pollo", "1 limón"],
    steps: [{ instruction: "Cocinar el pollo.", minutes: 10 }, { instruction: "Servir." }],
  });
  const detail = `/g/${groupId}/recetas/${recipeId}`;

  // 1) A genera el link público.
  await pageA.goto(detail);
  await pageA.getByRole("button", { name: "Compartir" }).tap();
  await pageA.getByRole("button", { name: /Mandar link/ }).tap();
  const shareUrl = (await pageA.getByTestId("share-url").innerText()).trim();
  expect(shareUrl).toMatch(/\/r\/[A-Za-z0-9_-]{24}$/);
  const publicPath = new URL(shareUrl).pathname;

  // 2) Alguien sin cuenta lo abre: ve la receta, el preview (og:image) y la imagen se genera.
  const anon = await browser.newContext();
  const pageAnon = await anon.newPage();
  await pageAnon.goto(publicPath);
  await expect(pageAnon.getByRole("heading", { name: "Pollo al limón compartido" })).toBeVisible();
  await expect(pageAnon.getByText("Compartida por Ana")).toBeVisible();
  await expect(pageAnon.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const ogImage = await pageAnon.locator('meta[property="og:image"]').getAttribute("content");
  expect(ogImage).toContain("/opengraph-image");
  const og = await anon.request.get(`${publicPath}/opengraph-image`);
  expect(og.status()).toBe(200);
  expect(og.headers()["content-type"]).toContain("image/png");

  // 3) Lo guarda: el link lo manda a entrar y vuelve a elegir el grupo.
  await pageAnon.getByRole("link", { name: "Guardala en tu recetario" }).tap();
  await pageAnon.waitForURL(/\/login\?next=/);
  await pageAnon.getByLabel("Email").fill(cEmail);
  await pageAnon.getByLabel("Contraseña").fill(password);
  await pageAnon.locator('form button[type="submit"]').tap();
  await pageAnon.waitForURL(/\/r\/.+\/guardar/);
  await pageAnon.getByRole("button", { name: /Mis recetas/ }).tap();
  await pageAnon.waitForURL(/\/g\/.+\/recetas\/[0-9a-f-]{36}$/);
  await expect(pageAnon.getByRole("heading", { name: "Pollo al limón compartido" })).toBeVisible();
  await expect(pageAnon.getByText(/Basada en/)).toBeVisible();

  // 4) A deja de compartir: el link muestra "no disponible".
  await pageA.reload();
  await pageA.getByRole("button", { name: "Compartir" }).tap();
  await pageA.getByRole("button", { name: /Mandar link/ }).tap();
  await pageA.getByRole("button", { name: "Dejar de compartir" }).tap();
  await expect(pageA.getByText("Dejaste de compartir la receta")).toBeVisible();
  const anon2 = await browser.newContext();
  const pageAnon2 = await anon2.newPage();
  await pageAnon2.goto(publicPath);
  await expect(pageAnon2.getByText("Este link ya no está disponible")).toBeVisible();

  // 5) A copia la receta a otro grupo suyo.
  const familiaId = await createGroupAs(aEmail, password, "Familia");
  await addMemberToGroup(familiaId, bId);
  await pageA.goto(detail);
  await pageA.getByRole("button", { name: "Compartir" }).tap();
  await pageA.getByRole("button", { name: /Copiar a otro grupo/ }).tap();
  await pageA.getByRole("button", { name: /Familia/ }).tap();
  await pageA.getByRole("button", { name: "Copiar", exact: true }).tap();
  await expect(pageA.getByText("Copiada a Familia")).toBeVisible();

  // 6) A le manda la receta a B (comparten "Familia").
  await pageA.goto(detail);
  await pageA.getByRole("button", { name: "Compartir" }).tap();
  await pageA.getByRole("button", { name: /Mandar a una persona/ }).tap();
  await pageA.getByRole("button", { name: /Beto/ }).tap();
  await expect(pageA.getByText("Le llegó a Beto")).toBeVisible();

  // 7) B la ve en la bandeja (con badge), la guarda y el badge desaparece.
  const ctxB = await mobileContext(browser);
  const pageB = await ctxB.newPage();
  await signIn(pageB, bEmail, password);
  await expect(pageB.getByRole("status", { name: /1 novedad/ })).toBeVisible();
  await pageB.goto("/perfil/bandeja");
  await expect(pageB.getByText(/te compartió/)).toBeVisible();
  await pageB.getByRole("button", { name: "Guardar" }).tap();
  await pageB.getByRole("button", { name: /Mis recetas/ }).tap();
  await expect(pageB.getByText("Guardada en Mis recetas")).toBeVisible();
  await expect(pageB.getByText("No tenés novedades")).toBeVisible();
  await expect(pageB.getByRole("status", { name: /novedad/ })).toHaveCount(0);

  await Promise.all([ctxA.close(), ctxB.close(), anon.close(), anon2.close()]);
});
