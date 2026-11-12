import { expect, test } from "@playwright/test";
import { adminClient, createTestUser, mobileContext, signIn } from "./helpers/auth";
import { createGroupAs, seedRecipe } from "./helpers/recipes";
import { todayString, weekStartOf } from "../../lib/domain/week";

const password = "password123";

test("hoy: sin plan muestra los arranques y con la cena planeada muestra 'Empezar a cocinar'", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const email = `hoy-${Date.now()}@test.com`;
  const userId = await createTestUser(email, password, "Ana");
  const groupId = await createGroupAs(email, password, "Casa");
  const recipeId = await seedRecipe(email, password, groupId, {
    title: "Pollo con arroz",
    ingredients: ["1 pollo", "2 tazas de arroz"],
    steps: [{ instruction: "Cociná." }],
  });

  const page = await (await mobileContext(browser)).newPage();
  await signIn(page, email, password);
  await page.goto(`/g/${groupId}/hoy`);
  await expect(page.getByRole("heading", { name: "¿Qué comemos hoy?" })).toBeVisible();

  const today = todayString();
  const admin = adminClient();
  const { data: plan, error } = await admin
    .from("meal_plans")
    .insert({
      group_id: groupId,
      week_start: weekStartOf(today, 1),
      status: "approved",
      created_by: userId,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  const { error: entryError } = await admin.from("meal_plan_entries").insert([
    { plan_id: plan!.id, date: today, slot: "lunch", recipe_id: recipeId },
    { plan_id: plan!.id, date: today, slot: "dinner", recipe_id: recipeId },
  ]);
  expect(entryError).toBeNull();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Pollo con arroz" })).toBeVisible();
  const cook = page.getByRole("link", { name: /Empezar a cocinar/ });
  await expect(cook).toBeVisible();
  await expect(cook).toHaveAttribute("href", new RegExp(`/recetas/${recipeId}/cocinar`));
});

test("¿Qué tenés?: sugiere recetas, elegir una la deja en hoy con 'Empezar a cocinar'", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const email = `quetenes-${Date.now()}@test.com`;
  await createTestUser(email, password, "Ana");
  const groupId = await createGroupAs(email, password, "Casa");
  const recipeId = await seedRecipe(email, password, groupId, {
    title: "Pollo con zapallitos",
    ingredients: ["1 pollo", "3 zapallitos", "1 limón"],
    steps: [{ instruction: "Cociná." }],
  });

  const page = await (await mobileContext(browser)).newPage();
  await signIn(page, email, password);

  // La IA se simula: los e2e no llaman a la API real.
  await page.route("**/api/ai/suggest", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        cards: [
          {
            recipeId,
            title: "Pollo con zapallitos",
            imageUrl: null,
            totalMinutes: 30,
            line: "Usa todo lo que tenés.",
            label: "Tenés todo",
            missing: [],
            isNew: false,
          },
        ],
      }),
    }),
  );

  await page.goto(`/g/${groupId}/hoy`);
  await page.getByLabel("Qué tenés ganas de comer").fill("algo con pollo");
  await page.getByRole("button", { name: "Buscar ideas" }).tap();
  await expect(page.getByLabel("¿Algún antojo? (opcional)")).toHaveValue("algo con pollo");
  await page.waitForLoadState("networkidle");

  // Reintenta hasta que la página termine de hidratarse.
  await expect(async () => {
    await page.getByLabel("Agregar un ingrediente").fill("pollo, zapallitos y limones");
    await page.getByRole("button", { name: "Agregar ingrediente" }).tap();
    await expect(
      page.getByRole("list", { name: "Ingredientes" }).getByText("zapallitos"),
    ).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
  await page.getByRole("button", { name: "Ver qué puedo cocinar" }).tap();
  await expect(page.getByText("Tenés todo")).toBeVisible();
  await page.getByRole("button", { name: "Elegir para hoy" }).tap();

  await expect(page).toHaveURL(new RegExp(`/g/${groupId}/hoy$`));
  await expect(page.getByRole("heading", { name: "Pollo con zapallitos" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Empezar a cocinar/ })).toBeVisible();
});
