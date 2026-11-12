import { expect, test, type Page } from "@playwright/test";
import { encodeSse, type AssistantEvent } from "../../lib/ai/assistant/events";
import { createTestUser, mobileContext, signIn } from "./helpers/auth";
import { seedRecipe } from "./helpers/recipes";

const password = "password123";

/** Responde el chat con eventos fijos (en CI no hay clave de IA y costaría plata). */
async function mockChat(
  page: Page,
  events: AssistantEvent[],
  onRequest?: (body: Record<string, unknown>) => void,
) {
  await page.route("**/api/ai/assistant/chat", async (route) => {
    onRequest?.(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      body: events.map(encodeSse).join(""),
    });
  });
}

async function setup(browser: import("@playwright/test").Browser) {
  const email = `ask-${Date.now()}-${Math.floor(Math.random() * 1e4)}@test.com`;
  await createTestUser(email, password, "Ana");
  const page = await (await mobileContext(browser)).newPage();
  await signIn(page, email, password);
  const groupId = page.url().split("/g/")[1]!.split("/")[0]!;
  const salmon = await seedRecipe(email, password, groupId, {
    title: "Salmón con rúcula",
    ingredients: ["2 filetes de salmón", "1 atado de rúcula"],
    steps: [
      { instruction: "Sellá el salmón.", minutes: 6 },
      { instruction: "Serví con la rúcula." },
    ],
  });
  const pollo = await seedRecipe(email, password, groupId, {
    title: "Pollo al limón",
    ingredients: ["400 g de pechuga de pollo", "1 limón"],
    steps: [{ instruction: "Cortá el pollo." }, { instruction: "Cociná el pollo.", minutes: 10 }],
  });
  return { page, groupId, email, salmon, pollo };
}

test("preguntale: citar dos recetas con @, preguntar y aplicar una propuesta como versión nueva", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const { page, groupId, salmon, pollo } = await setup(browser);
  let sent: Record<string, unknown> | null = null;
  await mockChat(
    page,
    [
      { type: "tool_started", name: "check_compatibility" },
      { type: "text_delta", text: "Combina mejor la ensalada. " },
      { type: "text_delta", text: "Sumale 2 minutos más al pollo." },
      {
        type: "proposal",
        proposal: {
          kind: "recipe_change",
          recipeId: pollo,
          recipeTitle: "Pollo al limón",
          changeNote: "Más cocción al pollo",
          ops: [{ op: "set_duration", step: 1, seconds: 720 }],
          summary: ["Paso 2: 10 min → 12 min"],
        },
      },
      { type: "done", conversationId: "00000000-0000-4000-8000-000000000001" },
    ],
    (body) => (sent = body),
  );

  await page.goto(`/g/${groupId}/preguntar`);
  const input = page.getByLabel(/Escribí tu pregunta/);

  // Cita la primera receta escribiendo @ y eligiendo del buscador.
  await input.fill("@Salm");
  await page.getByRole("option", { name: /Salmón con rúcula/ }).tap();
  // Cita la segunda con el botón @.
  await page.getByRole("button", { name: "Citar una receta" }).tap();
  await input.pressSequentially("Pol");
  await page.getByRole("option", { name: /Pollo al limón/ }).tap();
  await expect(
    page.getByRole("list", { name: "Recetas citadas" }).getByRole("listitem"),
  ).toHaveCount(2);

  await input.fill("¿Qué combina mejor?");
  await page.getByRole("button", { name: "Enviar pregunta" }).tap();

  // El mensaje viaja con las dos menciones y el contexto de inicio.
  await expect.poll(() => sent).not.toBeNull();
  expect((sent as unknown as { mentions: string[] }).mentions.sort()).toEqual(
    [pollo, salmon].sort(),
  );
  expect((sent as unknown as { context: { origin: string } }).context.origin).toBe("home");

  // La respuesta se arma con el streaming y trae la tarjeta de propuesta.
  await expect(
    page.getByText("Combina mejor la ensalada. Sumale 2 minutos más al pollo."),
  ).toBeVisible();
  await expect(page.getByText("Paso 2: 10 min → 12 min")).toBeVisible();

  // "Sumarlo a la receta" → confirmar → versión nueva.
  await page.getByRole("button", { name: "Sumarlo a la receta" }).tap();
  await page.getByRole("button", { name: "Confirmar" }).tap();
  await expect(page.getByText("Listo, ya quedó guardado.")).toBeVisible();

  await page.goto(`/g/${groupId}/recetas/${pollo}/historial`);
  await expect(page.getByText("Versión 2")).toBeVisible();
  await expect(page.getByText("Más cocción al pollo")).toBeVisible();
});

test("preguntale: 'Preguntar por esta receta' abre el chat con la receta citada", async ({
  browser,
}) => {
  const { page, groupId, pollo } = await setup(browser);
  let sent: Record<string, unknown> | null = null;
  await mockChat(
    page,
    [
      { type: "text_delta", text: "Sí, se puede." },
      { type: "done", conversationId: "00000000-0000-4000-8000-000000000002" },
    ],
    (b) => (sent = b),
  );

  await page.goto(`/g/${groupId}/recetas/${pollo}`);
  await page.getByRole("link", { name: "Preguntar por esta receta" }).tap();
  await page.waitForURL(/\/preguntar\?receta=/);
  await expect(page.getByRole("list", { name: "Recetas citadas" })).toContainText("Pollo al limón");

  await page.getByLabel(/Escribí tu pregunta/).fill("¿Se puede freezar?");
  await page.getByRole("button", { name: "Enviar pregunta" }).tap();
  await expect(page.getByText("Sí, se puede.")).toBeVisible();
  expect(
    (sent as unknown as { mentions: string[]; context: { origin: string; recipeId: string } })
      .mentions,
  ).toEqual([pollo]);
  expect(
    (sent as unknown as { context: { origin: string; recipeId: string } }).context,
  ).toMatchObject({ origin: "recipe", recipeId: pollo });
});

test("preguntale: no se puede citar la receta de otro grupo (403 real, sin llegar al modelo)", async ({
  browser,
}) => {
  const a = await setup(browser);
  const b = await setup(browser);
  const res = await b.page.request.post("/api/ai/assistant/chat", {
    data: { groupId: b.groupId, message: "hola", mentions: [a.pollo] },
  });
  expect(res.status()).toBe(403);
  const sinSesion = await (
    await browser.newContext()
  ).request.post("/api/ai/assistant/chat", {
    data: { groupId: a.groupId, message: "hola", mentions: [] },
  });
  expect(sinSesion.status()).toBe(401);
});
