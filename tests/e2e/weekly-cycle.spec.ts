import { expect, test } from "@playwright/test";
import {
  addMemberToGroup,
  adminClient,
  createTestUser,
  mobileContext,
  signIn,
} from "./helpers/auth";
import { createGroupAs, seedRecipe } from "./helpers/recipes";
import { addDays, todayString, weekStartOf } from "../../lib/domain/week";

const password = "password123";

test("ciclo semanal: plan con sobra → aprobar → lista → tachado compartido → editar y regenerar conserva lo tachado", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const run = Date.now();
  const aEmail = `ciclo-a-${run}@test.com`;
  const bEmail = `ciclo-b-${run}@test.com`;
  const aId = await createTestUser(aEmail, password, "Ana");
  const bId = await createTestUser(bEmail, password, "Beto");
  const groupId = await createGroupAs(aEmail, password, "Casa");
  await addMemberToGroup(groupId, bId);

  const r1 = await seedRecipe(aEmail, password, groupId, {
    title: "Pollo con papas",
    servings: 2,
    ingredients: ["500 g de pollo", "4 papas"],
    steps: [{ instruction: "Horneá." }],
  });
  const r2 = await seedRecipe(aEmail, password, groupId, {
    title: "Pollo al limón",
    servings: 2,
    ingredients: ["300 g de pollo", "2 limones"],
    steps: [{ instruction: "Salteá." }],
  });
  const r3 = await seedRecipe(aEmail, password, groupId, {
    title: "Puré de papas",
    servings: 2,
    ingredients: ["600 g de papa"],
    steps: [{ instruction: "Hervilo." }],
  });

  // Plan de la semana actual: día 1 pollo con papas, día 2 sobras de eso, día 3 pollo al limón y puré.
  const week = weekStartOf(todayString(), 1);
  const admin = adminClient();
  const { data: plan } = await admin
    .from("meal_plans")
    .insert({ group_id: groupId, week_start: week, created_by: aId })
    .select("id")
    .single();
  const { data: first } = await admin
    .from("meal_plan_entries")
    .insert({ plan_id: plan!.id, date: week, slot: "dinner", recipe_id: r1 })
    .select("id")
    .single();
  await admin.from("meal_plan_entries").insert([
    {
      plan_id: plan!.id,
      date: addDays(week, 1),
      slot: "lunch",
      recipe_id: r1,
      leftovers_of_entry_id: first!.id,
    },
    { plan_id: plan!.id, date: addDays(week, 2), slot: "dinner", recipe_id: r2 },
    { plan_id: plan!.id, date: addDays(week, 2), slot: "lunch", recipe_id: r3 },
  ]);

  const pageA = await (await mobileContext(browser)).newPage();
  await signIn(pageA, aEmail, password);
  await pageA.goto(`/g/${groupId}/plan`);
  await pageA.getByRole("button", { name: "Aprobar plan" }).tap();
  await expect(pageA.getByText("Aprobado", { exact: true })).toBeVisible();
  // El pipeline post-aprobación muestra su avance y termina.
  await expect(pageA.getByText(/Armando la lista|Sumando consejos|Preparando/)).toHaveCount(0, {
    timeout: 60_000,
  });

  // La lista suma bien: pollo 500 + 300 = 800 g (la sobra no cuenta) y papas 4 u + 600 g.
  await pageA.goto(`/g/${groupId}/compras`);
  const chicken = pageA.getByRole("checkbox", { name: /Comprado: pollo/i });
  await expect(chicken).toBeVisible({ timeout: 20_000 });
  await expect(pageA.getByText("800 g").first()).toBeVisible();
  await expect(pageA.getByText(/limon|limón/i).first()).toBeVisible();

  // B tacha el pollo y A lo ve tachado en vivo.
  const pageB = await (await mobileContext(browser)).newPage();
  await signIn(pageB, bEmail, password);
  await pageB.goto(`/g/${groupId}/compras`);
  await pageB.waitForLoadState("networkidle");
  await expect(async () => {
    await pageB.getByRole("checkbox", { name: /Comprado: pollo/i }).tap();
    await expect(pageB.getByRole("checkbox", { name: /Comprado: pollo/i })).toHaveAttribute(
      "aria-checked",
      "true",
      {
        timeout: 2000,
      },
    );
  }).toPass({ timeout: 15_000 });
  await expect(chicken).toHaveAttribute("aria-checked", "true", { timeout: 15_000 });

  // Se edita el plan (sale el pollo al limón) y se regenera: lo tachado se conserva.
  await pageA.goto(`/g/${groupId}/plan`);
  await pageA.getByRole("button", { name: /Pollo al limón/ }).tap();
  await pageA.getByRole("button", { name: /Quitar/ }).tap();
  await pageA.getByRole("button", { name: "Actualizar la lista de compras" }).tap();
  await expect(pageA.getByText("Lista de compras actualizada.")).toBeVisible();

  await pageA.goto(`/g/${groupId}/compras`);
  await expect(pageA.getByRole("checkbox", { name: /Comprado: pollo/i })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(pageA.getByText("500 g").first()).toBeVisible();
});
