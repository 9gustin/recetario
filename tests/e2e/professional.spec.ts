import { expect, test } from "@playwright/test";
import { adminClient, createTestUser, mobileContext, signIn } from "./helpers/auth";
import { createGroupAs } from "./helpers/recipes";

const password = "password123";

test("nutricionista: código, plan, envío, paciente acepta y seguimiento con permiso", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const stamp = Date.now();
  const proEmail = `pro-${stamp}@test.com`;
  const patEmail = `pac-${stamp}@test.com`;
  const proId = await createTestUser(proEmail, password, "Dra. Pro");
  const patId = await createTestUser(patEmail, password, "Paciente");
  const patGroup = await createGroupAs(patEmail, password, "Casa Paciente");
  const code = `E2E-${stamp}`;
  await adminClient().from("professional_invites").insert({ code, max_uses: 1 });

  // --- Profesional: se registra con el código.
  const proPage = await (await mobileContext(browser)).newPage();
  await signIn(proPage, proEmail, password);
  await proPage.goto("/pro");
  await expect(proPage).toHaveURL(/\/pro\/registro/);
  await proPage.getByLabel("Código de invitación").fill("incorrecto-123");
  await proPage.getByRole("button", { name: "Activar mi cuenta profesional" }).tap();
  await expect(proPage.getByText("Ese código no es válido")).toBeVisible();
  await proPage.getByLabel("Código de invitación").fill(code);
  await proPage.getByLabel("Tu nombre profesional").fill("Lic. Ana Pérez");
  await proPage.getByRole("button", { name: "Activar mi cuenta profesional" }).tap();
  await expect(proPage.getByRole("heading", { name: "Lic. Ana Pérez" })).toBeVisible();

  // --- Arma un plan con una comida escrita.
  await proPage.goto("/pro/planes/nuevo");
  await proPage.getByLabel("Título del plan").fill("Más verduras");
  await proPage.getByRole("button", { name: "Más verduras" }).first().tap(); // objetivo frecuente
  await proPage.getByLabel("Agregar una comida escrita").fill("Pollo con ensalada");
  await proPage.getByRole("button", { name: "Agregar comida escrita" }).tap();
  await expect(proPage.getByText("Pollo con ensalada")).toBeVisible();
  await proPage.getByRole("button", { name: "Más Pollo con ensalada" }).tap();
  await proPage.getByRole("button", { name: "Guardar plan" }).tap();
  await expect(proPage).toHaveURL(/\/pro\/planes\/[0-9a-f-]{36}/);

  // --- Invita al paciente.
  await proPage.goto("/pro");
  await proPage.getByLabel("Nombre del paciente").fill("Paciente B");
  await proPage.getByRole("button", { name: "Invitar" }).tap();
  await expect(proPage.getByRole("status")).toContainText("link de invitación");
  const { data: link } = await adminClient()
    .from("pro_links")
    .select("id, token")
    .eq("pro_id", proId)
    .single();

  // --- Paciente: acepta y comparte su registro.
  const patPage = await (await mobileContext(browser)).newPage();
  await signIn(patPage, patEmail, password);
  await patPage.goto(`/p/${link!.token}`);
  await expect(patPage.getByText("Lic. Ana Pérez")).toBeVisible();
  await patPage.getByLabel(/Mi registro de comidas/).check();
  await patPage.getByRole("button", { name: "Aceptar invitación" }).tap();
  await expect(patPage.getByRole("heading", { name: "Mis profesionales" })).toBeVisible();

  // --- Profesional: envía el plan.
  await proPage.goto(`/pro/pacientes/${link!.id}`);
  await proPage.getByLabel("Mensaje (opcional)").fill("Probalo esta semana");
  await proPage.getByRole("button", { name: "Enviar plan" }).tap();
  await expect(proPage.getByText("Pendiente")).toBeVisible();

  // --- Paciente: suma el plan a Mis comidas sin pisar nada.
  await patPage.goto("/perfil/profesional");
  await expect(patPage.getByText("Probalo esta semana")).toBeVisible();
  await patPage.getByLabel("¿En qué grupo lo guardamos?").selectOption({ value: patGroup });
  await patPage.getByRole("button", { name: "Sumar a mis comidas" }).tap();
  await expect(patPage.getByText("Sumado a Mis comidas.")).toBeVisible();
  await patPage.goto(`/g/${patGroup}/plan`);
  await expect(patPage.getByText("Pollo con ensalada")).toBeVisible();
  await expect(patPage.getByLabel("2 veces")).toBeVisible();

  // --- Seguimiento: el paciente cargó una comida y el profesional la ve.
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
  await adminClient()
    .from("meal_logs")
    .insert({ user_id: patId, date: today, slot: "lunch", status: "followed" });
  await proPage.goto(`/pro/pacientes/${link!.id}`);
  await expect(proPage.getByText("Lo siguió")).toBeVisible();

  // --- El paciente deja de compartir: el profesional ya no ve nada.
  await patPage.goto("/perfil/profesional");
  await patPage.getByLabel("Compartir mi registro de comidas").click();
  await expect(patPage.getByText("Listo.")).toBeVisible();
  await proPage.goto(`/pro/pacientes/${link!.id}`);
  await expect(proPage.getByText(/todavía no te compartió su registro/)).toBeVisible();
  await expect(proPage.getByText("Lo siguió")).toHaveCount(0);
});
