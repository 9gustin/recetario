import { expect, test } from "@playwright/test";
import {
  addMemberToGroup,
  adminClient,
  createTestUser,
  mobileContext,
  signIn,
} from "./helpers/auth";
import { createGroupAs, seedRecipe } from "./helpers/recipes";

const password = "password123";

test("mis datos: exportar y borrar la cuenta deja las recetas del grupo compartido con otro dueño", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const run = Date.now();
  const aEmail = `del-a-${run}@test.com`;
  const bEmail = `del-b-${run}@test.com`;
  const aId = await createTestUser(aEmail, password, "Ana");
  const bId = await createTestUser(bEmail, password, "Beto");
  const groupId = await createGroupAs(aEmail, password, "Casa");
  await addMemberToGroup(groupId, bId);
  await seedRecipe(aEmail, password, groupId, {
    title: "Receta que queda",
    ingredients: ["1 papa"],
    steps: [{ instruction: "Hervila." }],
  });
  const admin = adminClient();
  await admin.from("food_profiles").insert({ user_id: aId, summary: "privado", data: {} });

  const context = await mobileContext(browser);
  const page = await context.newPage();
  await signIn(page, aEmail, password);

  // Exportar: el JSON trae las recetas propias.
  const exported = await page.request.get("/api/account/export");
  expect(exported.status()).toBe(200);
  const json = await exported.json();
  expect(json.recipes.map((r: { title: string }) => r.title)).toContain("Receta que queda");
  expect(json.food_profile.summary).toBe("privado");

  await page.goto("/perfil/datos");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Borrar mi cuenta" }).tap();
  const confirm = page.getByRole("button", { name: "Borrar definitivamente" });
  await expect(confirm).toBeDisabled();
  await page.getByLabel(/Para confirmar/).fill("BORRAR MI CUENTA");
  await confirm.tap();
  await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });

  const { data: user } = await admin.auth.admin.getUserById(aId);
  expect(user.user).toBeNull();
  expect((await admin.from("food_profiles").select("user_id").eq("user_id", aId)).data).toEqual([]);
  const { data: role } = await admin
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", bId)
    .single();
  expect(role!.role).toBe("owner");
  expect(
    (await admin.from("recipes").select("title").eq("group_id", groupId)).data?.map((r) => r.title),
  ).toEqual(["Receta que queda"]);
});
