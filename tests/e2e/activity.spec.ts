import { expect, test } from "@playwright/test";
import { todayString, weekStartOf } from "../../lib/domain/week";
import { createTestUser, mobileContext, signIn } from "./helpers/auth";
import { createGroupAs } from "./helpers/recipes";

test("actividad: lo que navegás y hacés queda en Perfil → Actividad", async ({ browser }) => {
  test.setTimeout(90_000);
  const email = `act-${Date.now()}@test.com`;
  await createTestUser(email, "password123", "Ana");
  const groupId = await createGroupAs(email, "password123", "Casa");
  const page = await (await mobileContext(browser)).newPage();
  await signIn(page, email, "password123");
  await page.goto(`/g/${groupId}/compras`);
  await page.waitForLoadState("networkidle");
  await page.goto(`/g/${groupId}/plan/${weekStartOf(todayString())}`);
  await page.waitForLoadState("networkidle");

  await expect(async () => {
    await page.goto("/perfil/actividad");
    const items = page.getByRole("list", { name: "Movimientos" });
    await expect(items.getByText(`/g/${groupId}/compras`)).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30_000 });
});
