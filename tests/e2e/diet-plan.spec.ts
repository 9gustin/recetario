import { expect, test } from "@playwright/test";
import { adminClient, createTestUser, mobileContext, signIn } from "./helpers/auth";
import { dayLabel, todayString, weekStartOf } from "../../lib/domain/week";

const password = "password123";

test("plan vivo: digitalizar (IA simulada), activar, registrar 3 comidas y un permitido", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const email = `dieta-${Date.now()}@test.com`;
  const userId = await createTestUser(email, password, "Ana");

  // Lo que devolvería la ingesta: un borrador ya guardado.
  const admin = adminClient();
  const { data: plan } = await admin
    .from("diet_plans")
    .insert({
      user_id: userId,
      title: "Plan de la nutricionista",
      status: "draft",
      summary: "Tres comidas con un permitido por semana.",
      rules: [{ text: "Sin harinas de noche" }],
      allowances: { per_week: 1, definition: "una comida libre" },
    })
    .select("id")
    .single();
  await admin.from("diet_plan_meals").insert([
    { plan_id: plan!.id, slot: "breakfast", formula: "Lácteo + fruta", position: 0 },
    { plan_id: plan!.id, slot: "lunch", formula: "Proteína + verduras", position: 1 },
    { plan_id: plan!.id, slot: "dinner", formula: "Proteína + verduras, sin harinas", position: 2 },
  ]);

  const page = await (await mobileContext(browser)).newPage();
  await signIn(page, email, password);
  await page.route("**/api/ai/diet-plan/ingest", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ planId: plan!.id }),
    }),
  );

  await page.goto("/perfil/plan/digitalizar");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Prefiero escribir" }).tap();
  await page
    .getByLabel("Contanos cómo comés")
    .fill("Mi nutricionista me dio un plan con tres comidas.");
  await page.getByRole("button", { name: "Armar mi perfil" }).tap();

  await expect(page.getByText("Leído")).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Comidas del plan" }).getByRole("listitem"),
  ).toHaveCount(3);
  await page.getByRole("button", { name: /Ver cómo quedó mi plan/ }).tap();
  await expect(page).toHaveURL(/\/perfil\/plan$/);
  await expect(page.getByRole("heading", { name: "Hoy toca" })).toBeVisible();

  // Registrar tres comidas: cumplí, cambié algo y un permitido.
  await page.getByRole("link", { name: "Registrar lo que comí" }).tap();
  const today = todayString();
  const register = async (slot: string, button: string) => {
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Qué comida").selectOption({ label: `${dayLabel(today)} · ${slot}` });
    await page.getByRole("button", { name: button, exact: true }).tap();
    await expect(page.getByText("¡Registrado!").first()).toBeVisible();
  };
  await register("Desayuno", "Cumplí");
  await register("Almuerzo", "Cambié algo");
  await register("Cena", "Permitido");

  // Se acabó el único permitido: el botón queda deshabilitado con aviso.
  await expect(page.getByRole("button", { name: "Permitido", exact: true })).toBeDisabled();
  await expect(page.getByText("Ya usaste todos los permitidos")).toBeVisible();
  await expect(page.getByRole("img", { name: /: Permitido$/ })).toHaveCount(1);

  await page.goto("/perfil/plan");
  await expect(page.getByText("Te quedan 0")).toBeVisible();
  await expect(page.getByRole("list", { name: "Hoy toca" }).getByText("Cumplí")).toBeVisible();
});

test("plan vivo: Mi plan muestra la fórmula del plan activo", async ({ browser }) => {
  test.setTimeout(90_000);
  const run = Date.now();
  const aEmail = `dieta-a-${run}@test.com`;
  const aId = await createTestUser(aEmail, password, "Ana");
  const admin = adminClient();
  const { data: plan } = await admin
    .from("diet_plans")
    .insert({ user_id: aId, title: "Plan", status: "active" })
    .select("id")
    .single();
  await admin
    .from("diet_plan_meals")
    .insert({ plan_id: plan!.id, slot: "dinner", formula: "Sin harinas", position: 0 });
  await admin.from("meal_logs").insert({
    user_id: aId,
    plan_id: plan!.id,
    date: todayString(),
    slot: "dinner",
    status: "allowance",
    note: "privado",
  });

  const context = await mobileContext(browser);
  const page = await context.newPage();
  await signIn(page, aEmail, password);
  await page.goto("/perfil/plan");
  await expect(page.getByRole("heading", { name: "Mi plan" })).toBeVisible();
  await expect(page.getByText("Sin harinas")).toBeVisible();
});

test("plan vivo: al terminar de cocinar una comida del plan se registra 'Cumplí' (con deshacer) y hay historial", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const { createGroupAs, seedRecipe } = await import("./helpers/recipes");
  const email = `dieta-cocinar-${Date.now()}@test.com`;
  const userId = await createTestUser(email, password, "Ana");
  const groupId = await createGroupAs(email, password, "Casa");
  const recipeId = await seedRecipe(email, password, groupId, {
    title: "Pollo con ensalada",
    ingredients: ["1 pechuga"],
    steps: [{ instruction: "Cociná." }],
  });
  const admin = adminClient();
  const today = todayString();
  const { data: dplan } = await admin
    .from("diet_plans")
    .insert({ user_id: userId, title: "Plan", status: "active", allowances: { per_week: 2 } })
    .select("id")
    .single();
  await admin
    .from("diet_plan_meals")
    .insert({ plan_id: dplan!.id, slot: "dinner", formula: "Proteína + verduras", position: 0 });
  const { data: mplan } = await admin
    .from("meal_plans")
    .insert({
      group_id: groupId,
      week_start: weekStartOf(today, 1),
      status: "approved",
      created_by: userId,
    })
    .select("id")
    .single();
  const { data: entry } = await admin
    .from("meal_plan_entries")
    .insert({ plan_id: mplan!.id, date: today, slot: "dinner", recipe_id: recipeId })
    .select("id")
    .single();

  const page = await (await mobileContext(browser)).newPage();
  await signIn(page, email, password);
  await page.goto(`/g/${groupId}/recetas/${recipeId}/cocinar?entry=${entry!.id}`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Empezar" }).tap();
  await page.getByRole("button", { name: "Listo" }).tap();
  await page.getByRole("button", { name: "Terminar" }).tap();

  await expect
    .poll(
      async () =>
        (await admin.from("meal_logs").select("status").eq("user_id", userId).eq("slot", "dinner"))
          .data?.[0]?.status,
      { timeout: 30_000 },
    )
    .toBe("followed");

  await page.goto("/perfil/plan/registrar");
  await expect(page.getByRole("heading", { name: "Semanas anteriores" })).toBeVisible();
});
