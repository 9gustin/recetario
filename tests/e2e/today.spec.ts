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
