import { expect, test, type Page } from "@playwright/test";
import { adminClient, createTestUser, mobileContext, signIn } from "./helpers/auth";

const password = "password123";

const QUESTION =
  "¿También tenés que evitar la cebolla de verdeo, el puerro, el echalote y el ajo, o solo la cebolla?";

const profile1 = {
  restrictions: [
    { target: "cebolla", type: "ingredient", severity: "forbidden", reason: "tratamiento" },
    { target: "harinas", type: "category", severity: "limit", limit: "evitar en la cena" },
  ],
  goals: [],
  likes: ["pollo"],
  dislikes: [],
  cuisines: [],
  schedule: { weekday_cook_minutes_max: 30 },
  equipment: ["horno"],
  skill: null,
  valid_until: null,
};
const profile2 = {
  ...profile1,
  restrictions: [
    { ...profile1.restrictions[0], includes: ["cebolla de verdeo", "puerro"] },
    profile1.restrictions[1],
  ],
};

async function insertDraft(
  userId: string,
  proposed: unknown,
  summary: string,
  changes: unknown[],
  questions: string[],
) {
  const { data, error } = await adminClient()
    .from("food_profile_drafts")
    .insert({ user_id: userId, proposed, summary, changes, open_questions: questions } as never)
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Cada llamada a la ingesta crea su borrador en la base (como el endpoint real) y devuelve la propuesta. */
async function mockIngest(
  page: Page,
  userId: string,
  proposals: { summary: string; profile: unknown; changes: unknown[]; open_questions: string[] }[],
  seen: Record<string, unknown>[],
  draftIds: string[],
) {
  const queue = [...proposals];
  await page.route("**/api/ai/food-profile/ingest", async (route) => {
    seen.push(route.request().postDataJSON() as Record<string, unknown>);
    const proposal = queue.shift()!;
    const draftId = await insertDraft(
      userId,
      proposal.profile,
      proposal.summary,
      proposal.changes,
      proposal.open_questions,
    );
    draftIds.push(draftId);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ draftId, proposal }),
    });
  });
}

test("mi alimentación: de cero a perfil guardado, responder una pregunta, editar chips y borrar fuentes", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const email = `food-${Date.now()}@test.com`;
  const userId = await createTestUser(email, password, "Ana");
  const page = await (await mobileContext(browser)).newPage();
  await signIn(page, email, password);

  const seen: Record<string, unknown>[] = [];
  const draftIds: string[] = [];
  await mockIngest(
    page,
    userId,
    [
      {
        profile: profile1,
        summary: "No podés comer cebolla y tratás de evitar las harinas a la noche.",
        changes: [{ op: "add", path: "restrictions", text: "Agregué: no come cebolla" }],
        open_questions: [QUESTION],
      },
      {
        profile: profile2,
        summary: "No podés comer cebolla, verdeo ni puerro.",
        changes: [
          {
            op: "change",
            path: "restrictions",
            text: "Cambié: la cebolla incluye verdeo y puerro",
          },
        ],
        open_questions: [],
      },
    ],
    seen,
    draftIds,
  );

  await page.goto("/perfil/alimentacion");
  await expect(page.getByText("Contame cómo comés").first()).toBeVisible();
  await expect(page.getByText(/no reemplaza el consejo de tu médico/)).toBeVisible();

  // Escribe (en vez de hablar) y arma el perfil.
  await page.getByRole("button", { name: "Prefiero escribir" }).tap();
  await page
    .getByLabel("Contanos cómo comés")
    .fill("No puedo comer cebolla y trato de evitar las harinas a la noche.");
  await page.getByRole("button", { name: "Armar mi perfil" }).tap();

  // Revisión: resumen, cambios y la pregunta de la familia allium.
  await expect(page.getByRole("heading", { name: "Revisá tu perfil" })).toBeVisible();
  await expect(page.getByText("Agregué: no come cebolla")).toBeVisible();
  await expect(page.getByText(QUESTION)).toBeVisible();

  // Contesta "Sí": la nueva propuesta parte del borrador pendiente.
  await page.getByRole("button", { name: "Sí", exact: true }).tap();
  await expect(page.getByText("Cambié: la cebolla incluye verdeo y puerro")).toBeVisible();
  expect(seen[1]).toMatchObject({
    baseDraftId: draftIds[0],
    answers: [{ question: QUESTION, answer: "Sí" }],
  });
  await expect(page.getByText(QUESTION)).toHaveCount(0);

  // Guarda el perfil.
  await page.getByRole("button", { name: "Guardar perfil" }).tap();
  await expect(page.getByText("NO COMÉS")).toBeVisible();
  await expect(page.getByText("cebolla (+ cebolla de verdeo, puerro)")).toBeVisible();
  await expect(page.getByText(/harinas · evitar en la cena/)).toBeVisible();

  // Edita los chips: saca "harinas" y suma "maní" a mano buscando en el catálogo.
  await page.getByRole("button", { name: /Quitar harinas/ }).tap();
  await expect(page.getByText("Nada por ahora.")).toBeVisible();
  await page.getByRole("button", { name: "+ agregar" }).tap();
  await page.getByLabel("Buscar ingrediente o familia").fill("mani");
  await page.getByRole("button", { name: /maní/i }).first().tap();
  await expect(page.getByText("maní").first()).toBeVisible();

  // Persistió en la base (versión 1 + dos ediciones) y no es visible para otros por RLS.
  await page.reload();
  await expect(page.getByText("NO COMÉS")).toBeVisible();
  await expect(page.getByRole("button", { name: /Quitar harinas/ })).toHaveCount(0);
  const { data: saved } = await adminClient()
    .from("food_profiles")
    .select("version, data")
    .eq("user_id", userId)
    .single();
  expect(saved?.version).toBe(3);
  expect(
    (saved?.data as { restrictions: { target: string }[] }).restrictions.map((r) => r.target),
  ).toEqual(["cebolla", "maní"]);

  // Mis fuentes: se puede borrar una.
  await adminClient()
    .from("food_profile_inputs")
    .insert({ user_id: userId, kind: "text", transcript: "No puedo comer cebolla" } as never);
  await page.reload();
  await expect(page.getByText("No puedo comer cebolla").first()).toBeVisible();
  await page.getByRole("button", { name: /Borrar texto/ }).tap();
  await expect(page.getByText("No puedo comer cebolla")).toHaveCount(0);
});
