import { expect, test } from "@playwright/test";
import { adminClient, createTestUser } from "./helpers/auth";
import { addDays, todayString, weekStartOf } from "../../lib/domain/week";

test("cron tick: sin secreto responde 401 y con secreto marca las preparaciones vencidas", async ({
  request,
}) => {
  const secret = process.env.CRON_SECRET;
  test.skip(!secret, "Falta CRON_SECRET en el entorno");

  const denied = await request.post("/api/cron/tick");
  expect(denied.status()).toBe(401);
  expect(
    (await request.post("/api/cron/tick", { headers: { Authorization: "Bearer otro" } })).status(),
  ).toBe(401);

  const userId = await createTestUser(`push-${Date.now()}@test.com`, "password123", "Ana");
  const admin = adminClient();
  const { data: group } = await admin
    .from("profiles")
    .select("personal_group_id")
    .eq("id", userId)
    .single();
  const today = todayString();
  const { data: plan } = await admin
    .from("meal_plans")
    .insert({
      group_id: group!.personal_group_id!,
      week_start: weekStartOf(today, 1),
      status: "approved",
      created_by: userId,
    })
    .select("id")
    .single();
  const { data: task } = await admin
    .from("prep_tasks")
    .insert({
      plan_id: plan!.id,
      title: "Cortar verduras",
      kind: "cut",
      suggested_date: addDays(today, 0),
      remind_at: new Date(Date.now() - 60_000).toISOString(),
    })
    .select("id")
    .single();

  const ok = await request.post("/api/cron/tick", {
    headers: { Authorization: `Bearer ${secret}` },
  });
  expect(ok.status()).toBe(200);
  const { data: after } = await admin
    .from("prep_tasks")
    .select("reminded_at")
    .eq("id", task!.id)
    .single();
  expect(after!.reminded_at).not.toBeNull();
});
