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

test("bandeja: aprobar el plan avisa a los demás miembros y se puede marcar todo como leído", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const run = Date.now();
  const aEmail = `inbox-a-${run}@test.com`;
  const bEmail = `inbox-b-${run}@test.com`;
  const aId = await createTestUser(aEmail, password, "Ana");
  const bId = await createTestUser(bEmail, password, "Beto");
  const groupId = await createGroupAs(aEmail, password, "Casa");
  await addMemberToGroup(groupId, bId);
  const recipe = await seedRecipe(aEmail, password, groupId, {
    title: "Arroz con huevo",
    ingredients: ["1 taza de arroz", "2 huevos"],
    steps: [{ instruction: "Cociná." }],
  });
  const admin = adminClient();
  const week = weekStartOf(todayString(), 1);
  const { data: plan } = await admin
    .from("meal_plans")
    .insert({ group_id: groupId, week_start: week, created_by: aId })
    .select("id")
    .single();
  await admin
    .from("meal_plan_entries")
    .insert({ plan_id: plan!.id, date: week, slot: "dinner", recipe_id: recipe });

  const pageA = await (await mobileContext(browser)).newPage();
  await signIn(pageA, aEmail, password);
  await pageA.goto(`/g/${groupId}/plan`);
  await pageA.getByRole("button", { name: "Aprobar plan" }).tap();
  await expect(pageA.getByText("Aprobado", { exact: true })).toBeVisible();

  const pageB = await (await mobileContext(browser)).newPage();
  await signIn(pageB, bEmail, password);
  await pageB.goto("/perfil/bandeja");
  await expect(pageB.getByText("Ana aprobó el plan de la semana")).toBeVisible({ timeout: 20_000 });
  await pageB.waitForLoadState("networkidle");
  await pageB.getByRole("button", { name: "Marcar todo como leído" }).tap();
  const { data: unread } = await admin
    .from("inbox_items")
    .select("id")
    .eq("user_id", bId)
    .is("read_at", null);
  await expect
    .poll(
      async () =>
        (await admin.from("inbox_items").select("id").eq("user_id", bId).is("read_at", null)).data
          ?.length ?? 1,
      { timeout: 15_000 },
    )
    .toBe(0);
  expect(unread).toBeTruthy();
});

test("offline: se tacha la lista sin conexión y al volver la red se sincroniza", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const email = `offline-${Date.now()}@test.com`;
  const userId = await createTestUser(email, password, "Ana");
  const groupId = await createGroupAs(email, password, "Casa");
  const admin = adminClient();
  const { data: list } = await admin
    .from("shopping_lists")
    .insert({ group_id: groupId, name: "Compra offline", created_by: userId })
    .select("id")
    .single();
  const { data: item } = await admin
    .from("shopping_list_items")
    .insert([
      { list_id: list!.id, display_name: "Zanahorias", aisle: "verduleria" },
      { list_id: list!.id, display_name: "Leche", aisle: "lacteos" },
    ])
    .select("id, display_name");

  const context = await mobileContext(browser);
  const page = await context.newPage();
  await signIn(page, email, password);
  await page.goto(`/g/${groupId}/compras/${list!.id}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("checkbox", { name: "Comprado: Zanahorias" })).toBeVisible();

  await context.setOffline(true);
  await page.getByRole("checkbox", { name: "Comprado: Zanahorias" }).tap();
  await expect(page.getByText(/Sin conexión/)).toBeVisible();

  await context.setOffline(false);
  const zanahorias = item!.find((i) => i.display_name === "Zanahorias")!.id;
  await expect
    .poll(
      async () =>
        (await admin.from("shopping_list_items").select("state").eq("id", zanahorias).single()).data
          ?.state,
      { timeout: 20_000 },
    )
    .toBe("bought");
});

test("compras: deslizar a la derecha marca comprado y a la izquierda 'ya lo tengo'", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const email = `swipe-${Date.now()}@test.com`;
  const userId = await createTestUser(email, password, "Ana");
  const groupId = await createGroupAs(email, password, "Casa");
  const admin = adminClient();
  const { data: list } = await admin
    .from("shopping_lists")
    .insert({ group_id: groupId, name: "Compra swipe", created_by: userId })
    .select("id")
    .single();
  await admin.from("shopping_list_items").insert([
    { list_id: list!.id, display_name: "Manzanas", aisle: "verduleria", position: 0 },
    { list_id: list!.id, display_name: "Arroz", aisle: "almacen", position: 0 },
  ]);
  const page = await (await mobileContext(browser)).newPage();
  await signIn(page, email, password);
  await page.goto(`/g/${groupId}/compras/${list!.id}`);
  await page.waitForLoadState("networkidle");

  const drag = async (name: string, dx: number) => {
    const box = (await page.getByRole("checkbox", { name: `Comprado: ${name}` }).boundingBox())!;
    const y = box.y + box.height / 2;
    const x = box.x + box.width + 40;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx / 2, y, { steps: 5 });
    await page.mouse.move(x + dx, y, { steps: 5 });
    await page.mouse.up();
  };
  await expect(async () => {
    await drag("Manzanas", 200);
    await expect(page.getByRole("checkbox", { name: "Comprado: Manzanas" })).toHaveAttribute(
      "aria-checked",
      "true",
      { timeout: 2000 },
    );
  }).toPass({ timeout: 20_000 });
  await expect(async () => {
    await drag("Arroz", -200);
    await expect(page.getByRole("button", { name: /Volver a pendiente: Arroz/ })).toBeVisible({
      timeout: 2000,
    });
  }).toPass({ timeout: 20_000 });
});
