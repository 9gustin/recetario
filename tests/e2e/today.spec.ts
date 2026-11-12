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

test("Ideas para hoy: 3 ideas aptas con su motivo, 'Otras 3' no repite y elegir deja la cena en hoy", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const email = `ideas-${Date.now()}@test.com`;
  const userId = await createTestUser(email, password, "Ana");
  const groupId = await createGroupAs(email, password, "Casa");
  await adminClient()
    .from("food_profiles")
    .insert({
      user_id: userId,
      summary: "Sin cebolla",
      data: {
        restrictions: [{ target: "cebolla", type: "ingredient", severity: "forbidden" }],
        goals: [],
        likes: [],
        dislikes: [],
        cuisines: [],
        schedule: {},
      },
    });
  const titles = [
    "Fideos con manteca",
    "Tarta de zapallitos",
    "Milanesas con puré",
    "Ensalada rusa",
    "Revuelto gramajo",
  ];
  for (const title of titles) {
    await seedRecipe(email, password, groupId, {
      title,
      ingredients: ["2 papas", "1 huevo"],
      steps: [{ instruction: "Cociná." }],
      totalMinutes: 20,
      servings: 4,
    });
  }
  await seedRecipe(email, password, groupId, {
    title: "Tortilla con cebolla",
    ingredients: ["4 papas", "1 cebolla"],
    steps: [{ instruction: "Cociná." }],
    totalMinutes: 20,
  });

  const page = await (await mobileContext(browser)).newPage();
  await signIn(page, email, password);
  await page.goto(`/g/${groupId}/hoy`);
  await page.getByRole("link", { name: /Elegí/ }).tap();
  await expect(page).toHaveURL(/\/hoy\/ideas$/);

  const list = page.getByRole("list", { name: "Sugerencias" });
  await expect(list.getByRole("listitem")).toHaveCount(3);
  await expect(page.getByText("Tortilla con cebolla")).toHaveCount(0);
  // Cada idea explica por qué aparece.
  await expect(
    list.getByText(/Todavía no la cocinaste|Rinde para sobras|lista en/).first(),
  ).toBeVisible();
  const first = await list.getByRole("heading", { level: 3 }).allTextContents();

  await page.waitForLoadState("networkidle");
  // Toca "Otras 3 ideas" solo mientras se sigan viendo las primeras (si la página aún no hidrató, reintenta).
  await expect(async () => {
    const current = await list.getByRole("heading", { level: 3 }).allTextContents();
    if (current.length > 0 && current.every((t) => first.includes(t))) {
      await page.getByRole("button", { name: "Otras 3 ideas" }).tap({ timeout: 3000 });
    }
    const second = await list.getByRole("heading", { level: 3 }).allTextContents();
    expect(second.length).toBeGreaterThan(0);
    expect(second.some((t) => first.includes(t))).toBe(false);
  }).toPass({ timeout: 30_000 });

  await list.getByRole("button", { name: "Elegir para hoy" }).first().tap();
  await expect(page).toHaveURL(new RegExp(`/g/${groupId}/hoy$`));
  await expect(page.getByRole("link", { name: /Empezar a cocinar/ })).toBeVisible();
});

test("home por hora: almuerzo a las 12:40 (mediodía), arranques a las 18:10 (tarde), cena elegida y noche a las 21:00", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const email = `hora-${Date.now()}@test.com`;
  const userId = await createTestUser(email, password, "Ana");
  const groupId = await createGroupAs(email, password, "Casa");
  const lunchId = await seedRecipe(email, password, groupId, {
    title: "Fideos con tuco",
    ingredients: ["400 g de fideos", "4 tomates"],
    steps: [{ instruction: "Cociná." }],
  });
  await seedRecipe(email, password, groupId, {
    title: "Sopa de calabaza",
    ingredients: ["1 kg de calabaza"],
    steps: [{ instruction: "Cociná." }],
    totalMinutes: 20,
  });

  const context = await mobileContext(browser);
  const page = await context.newPage();
  await signIn(page, email, password);

  // Hoy en Argentina (UTC-3) a distintas horas; el servidor lee la cookie e2e-now.
  const today = todayString();
  const at = async (hhmm: string) => {
    const iso = `${today}T${hhmm}:00-03:00`;
    await context.addCookies([{ name: "e2e-now", value: iso, url: "http://localhost:3000" }]);
    await page.clock.setFixedTime(new Date(iso));
  };

  // Almuerzo planeado a las 12:40.
  const admin = adminClient();
  const { data: plan } = await admin
    .from("meal_plans")
    .insert({ group_id: groupId, week_start: weekStartOf(today, 1), created_by: userId })
    .select("id")
    .single();
  const { data: entry } = await admin
    .from("meal_plan_entries")
    .insert({ plan_id: plan!.id, date: today, slot: "lunch", recipe_id: lunchId })
    .select("id")
    .single();
  await at("12:40");
  await page.goto(`/g/${groupId}/hoy`);
  await expect(page.getByText("AL MEDIODÍA")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fideos con tuco" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-daypart", "mediodia");

  // Sin nada planeado a las 18:10: arranques y tema tarde.
  await admin.from("meal_plan_entries").delete().eq("id", entry!.id);
  await at("18:10");
  await page.goto(`/g/${groupId}/hoy`);
  await expect(page.getByRole("heading", { name: "¿Qué comemos hoy?" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-daypart", "tarde");

  // Elegir una idea: la home muestra la cena.
  await page.getByRole("link", { name: /Elegí/ }).tap();
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("list", { name: "Sugerencias" }).getByRole("listitem").first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Elegir para hoy" }).first().tap();
  await expect(page).toHaveURL(new RegExp(`/g/${groupId}/hoy$`));
  await expect(page.getByText("ESTA NOCHE")).toBeVisible();
  await expect(page.getByRole("link", { name: /Empezar a cocinar/ })).toBeVisible();

  // A las 21:00, tema noche.
  await at("21:00");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-daypart", "noche");
});
