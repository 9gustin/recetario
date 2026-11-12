import { expect, test } from "@playwright/test";
import { adminClient, createTestUser, mobileContext, signIn } from "./helpers/auth";
import { createGroupAs, seedRecipe } from "./helpers/recipes";

const password = "password123";

test("sitio público: sin sesión se busca, se abre una receta y guardar pide entrar", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  // Una receta publicada por alguien (vía RPC, como lo hace la app).
  const email = `pub-${Date.now()}@test.com`;
  await createTestUser(email, password, "Ana");
  const groupId = await createGroupAs(email, password, "Casa");
  const recipeId = await seedRecipe(email, password, groupId, {
    title: "Budín de limón público",
    ingredients: ["3 huevos", "1 limón", "200 g de harina"],
    steps: [{ instruction: "Mezclá todo.", minutes: 5 }, { instruction: "Horneá 40 minutos." }],
    totalMinutes: 50,
  });
  const admin = adminClient();
  const slug = `budin-de-limon-${Date.now().toString(36)}`;
  await admin
    .from("recipes")
    .update({ visibility: "public", slug, published_at: new Date().toISOString() })
    .eq("id", recipeId);

  const context = await mobileContext(browser); // sin sesión
  const page = await context.newPage();
  await page.goto("/");
  await expect(page).toHaveURL(/\/explorar/);

  await page.getByLabel("Buscar recetas").fill("budín limón");
  await page.getByRole("button", { name: "Buscar" }).tap();
  const card = page
    .getByRole("list", { name: "Recetas" })
    .getByRole("link", { name: /Budín de limón público/ });
  await expect(card).toBeVisible();
  await card.tap();

  await expect(
    page.getByRole("heading", { name: "Budín de limón público", level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ingredientes" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Entrá para guardarla/ })).toBeVisible();

  // Una receta privada no aparece.
  await admin.from("recipes").update({ visibility: "private" }).eq("id", recipeId);
  await page.goto("/explorar?q=" + encodeURIComponent("budín limón"));
  await expect(page.getByText("No encontramos recetas")).toBeVisible();

  // Con sesión, guardar copia la receta al grupo.
  await admin.from("recipes").update({ visibility: "public" }).eq("id", recipeId);
  const bEmail = `pub-b-${Date.now()}@test.com`;
  await createTestUser(bEmail, password, "Beto");
  const pageB = await (await mobileContext(browser)).newPage();
  await signIn(pageB, bEmail, password);
  await pageB.goto(`/receta/${slug}`);
  await pageB.waitForLoadState("networkidle");
  await pageB.getByRole("button", { name: "Guardar en mi recetario" }).tap();
  await expect(pageB).toHaveURL(/\/g\/[^/]+\/recetas\/[^/]+$/, { timeout: 20_000 });
  await expect(
    pageB.getByRole("heading", { name: "Budín de limón público" }).first(),
  ).toBeVisible();
});
