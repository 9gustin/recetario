import { expect, test } from "@playwright/test";
import { adminClient, createTestUser, mobileContext, signIn } from "./helpers/auth";
import { createGroupAs, seedRecipe } from "./helpers/recipes";

const password = "password123";

test("sitio público: sin sesión se busca, se abre una receta y guardar pide entrar", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const tag = `u${Date.now().toString(36)}`;
  // Una receta publicada por alguien (vía RPC, como lo hace la app).
  const email = `pub-${Date.now()}@test.com`;
  await createTestUser(email, password, "Ana");
  const groupId = await createGroupAs(email, password, "Casa");
  const recipeId = await seedRecipe(email, password, groupId, {
    title: `Budín de limón ${tag}`,
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

  await page.getByLabel("Buscar recetas").fill(`budín limón ${tag}`);
  await page.getByRole("button", { name: "Buscar" }).tap();
  const card = page
    .getByRole("list", { name: "Recetas" })
    .getByRole("link", { name: new RegExp(`Budín de limón ${tag}`) });
  await expect(card).toBeVisible();
  await card.tap();

  await expect(
    page.getByRole("heading", { name: `Budín de limón ${tag}`, level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ingredientes" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Entrá para guardarla/ })).toBeVisible();

  // Una receta privada no aparece.
  await admin.from("recipes").update({ visibility: "private" }).eq("id", recipeId);
  await page.goto("/explorar?q=" + encodeURIComponent(`budín limón ${tag}`));
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
  await expect(pageB.getByRole("heading", { name: `Budín de limón ${tag}` }).first()).toBeVisible();
});

test("hacer público: receta, colección y plan aparecen sin sesión; despublicar los saca", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const email = `pubui-${Date.now()}@test.com`;
  const userId = await createTestUser(email, password, "Ana");
  const groupId = await createGroupAs(email, password, "Casa");
  const recipeId = await seedRecipe(email, password, groupId, {
    title: "Ñoquis de calabaza compartidos",
    ingredients: ["500 g de calabaza", "300 g de harina"],
    steps: [{ instruction: "Hervila y pisala." }, { instruction: "Armá los ñoquis." }],
  });
  const admin = adminClient();
  const { data: plan } = await admin
    .from("meal_plans")
    .insert({ group_id: groupId, week_start: "2027-03-01", created_by: userId })
    .select("id")
    .single();
  await admin
    .from("meal_plan_entries")
    .insert({ plan_id: plan!.id, date: "2027-03-02", slot: "dinner", recipe_id: recipeId });

  const page = await (await mobileContext(browser)).newPage();
  const anon = await (await mobileContext(browser)).newPage();
  await signIn(page, email, password);

  // Receta pública desde su ficha.
  await page.goto(`/g/${groupId}/recetas/${recipeId}`);
  await page.waitForLoadState("networkidle");
  await expect(async () => {
    await page.getByRole("button", { name: "Hacer pública" }).tap({ timeout: 3000 });
    await expect(page.getByRole("link", { name: "Ver página pública" })).toBeVisible({
      timeout: 4000,
    });
  }).toPass({ timeout: 30_000 });
  await anon.goto("/explorar?q=" + encodeURIComponent("ñoquis calabaza"));
  await expect(
    anon.getByRole("list", { name: "Recetas" }).getByText("Ñoquis de calabaza compartidos"),
  ).toBeVisible();

  // Colección pública.
  await page.goto(`/g/${groupId}/recetas/colecciones`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nombre de la colección").fill("Cenas fáciles");
  await page.getByRole("button", { name: "Crear" }).tap();
  await expect(page).toHaveURL(/colecciones\/[0-9a-f-]{36}$/);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Agregar", exact: true }).tap();
  await expect(
    page
      .getByRole("list", { name: "Recetas de la colección" })
      .getByText("Ñoquis de calabaza compartidos"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Hacer pública" }).tap();
  await expect(page.getByRole("link", { name: "Ver página pública" })).toBeVisible();
  const href = await page.getByRole("link", { name: "Ver página pública" }).getAttribute("href");
  await anon.goto(href!);
  await expect(anon.getByRole("heading", { name: "Cenas fáciles", level: 1 })).toBeVisible();
  await expect(anon.getByText("Ñoquis de calabaza compartidos")).toBeVisible();

  // Plan público: lo ve cualquiera, sin datos del grupo.
  await page.goto(`/g/${groupId}/plan/2027-03-01`);
  await page.waitForLoadState("networkidle");
  page.once("dialog", (d) => void d.accept("Semana fácil"));
  await expect(async () => {
    await page.getByRole("button", { name: "Más opciones del plan" }).tap({ timeout: 3000 });
    await page.getByRole("menuitem", { name: "Publicar este plan" }).tap({ timeout: 3000 });
    await expect
      .poll(
        async () =>
          (await admin.from("plan_shares").select("slug").eq("plan_id", plan!.id)).data?.length,
        { timeout: 5000 },
      )
      .toBe(1);
  }).toPass({ timeout: 40_000 });
  const { data: share } = await admin
    .from("plan_shares")
    .select("slug")
    .eq("plan_id", plan!.id)
    .single();
  await anon.goto(`/plan-publico/${share!.slug}`);
  await expect(anon.getByRole("heading", { name: "Semana fácil", level: 1 })).toBeVisible();
  await expect(anon.getByRole("link", { name: "Ñoquis de calabaza compartidos" })).toBeVisible();
  await expect(anon.getByRole("link", { name: /Entrá para usar este plan/ })).toBeVisible();

  // Despublicar la receta la saca de Explorar.
  await page.goto(`/g/${groupId}/recetas/${recipeId}`);
  await page.waitForLoadState("networkidle");
  await expect(async () => {
    await page.getByRole("button", { name: "Volver a hacerla privada" }).tap({ timeout: 3000 });
    await expect(page.getByRole("button", { name: "Hacer pública" })).toBeVisible({
      timeout: 4000,
    });
  }).toPass({ timeout: 30_000 });
  await anon.goto("/explorar?q=" + encodeURIComponent("ñoquis calabaza"));
  await expect(anon.getByText("No encontramos recetas")).toBeVisible();
});

test("catálogo en la app: tus recetas primero y después 'Del catálogo', con guardar", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const email = `cat-${Date.now()}@test.com`;
  await createTestUser(email, password, "Ana");
  const groupId = await createGroupAs(email, password, "Casa");
  await seedRecipe(email, password, groupId, {
    title: "Mi tarta propia",
    ingredients: ["1 tapa de tarta"],
    steps: [{ instruction: "Horneá." }],
  });
  const admin = adminClient();
  const { count } = await admin
    .from("recipes")
    .select("id", { count: "exact", head: true })
    .eq("is_catalog", true);
  test.skip(!count, "Falta cargar el catálogo (pnpm catalog:load)");

  const page = await (await mobileContext(browser)).newPage();
  await signIn(page, email, password);
  await page.goto(`/g/${groupId}/recetas`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("link", { name: /Mi tarta propia/ }).first()).toBeVisible();
  const section = page.getByRole("region", { name: "Del catálogo" });
  await expect(section).toBeVisible({ timeout: 20_000 });
  await expect(
    section.getByRole("list", { name: "Recetas del catálogo" }).getByRole("listitem").first(),
  ).toBeVisible();
  await expect(async () => {
    await section.getByRole("button", { name: "Guardar" }).first().tap({ timeout: 3000 });
    await expect(page).toHaveURL(/\/recetas\/[0-9a-f-]{36}$/, { timeout: 5000 });
  }).toPass({ timeout: 30_000 });
});
