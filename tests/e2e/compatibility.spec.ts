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

test("compatibilidad: indicadores por persona, 'Para quién va' y filtro 'Apta para…'", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const run = Date.now();
  const aEmail = `compat-a-${run}@test.com`;
  const bEmail = `compat-b-${run}@test.com`;
  const aId = await createTestUser(aEmail, password, "Ana");
  const bId = await createTestUser(bEmail, password, "Beto");
  const casaId = await createGroupAs(aEmail, password, "Casa");
  await addMemberToGroup(casaId, bId);

  // Ana no come cebolla (prohibido) y limita las harinas; Beto no cargó perfil.
  await adminClient()
    .from("food_profiles")
    .insert({
      user_id: aId,
      summary: "Resumen privado con información médica",
      data: {
        restrictions: [
          { target: "cebolla", type: "ingredient", severity: "forbidden", reason: "tratamiento" },
          { target: "harinas", type: "category", severity: "limit", limit: "evitar en la cena" },
        ],
        goals: [],
        likes: [],
        dislikes: [],
        cuisines: [],
        schedule: {},
        equipment: [],
        skill: null,
        valid_until: null,
      },
    } as never);

  const tortilla = await seedRecipe(aEmail, password, casaId, {
    title: "Tortilla de papas con cebolla",
    ingredients: ["4 papas", "5 huevos", "1 cebolla"],
    steps: [{ instruction: "Cociná todo en la sartén." }],
  });
  await seedRecipe(aEmail, password, casaId, {
    title: "Ensalada de lechuga",
    ingredients: ["1 lechuga", "2 tomates"],
    steps: [{ instruction: "Mezclá y serví." }],
  });
  await seedRecipe(aEmail, password, casaId, {
    title: "Pan casero",
    ingredients: ["500 g de harina 000", "10 g de sal"],
    steps: [{ instruction: "Amasá y horneá." }],
  });

  const page = await (await mobileContext(browser)).newPage();
  await signIn(page, aEmail, password);
  await page.goto(`/g/${casaId}/recetas`);

  // Cada tarjeta muestra el estado para Ana (y solo para quienes tienen perfil: Beto no aparece).
  const card = (title: string) => page.getByRole("link", { name: new RegExp(title) });
  await expect(card("Tortilla de papas").getByLabel("Ana: no apta")).toBeVisible();
  await expect(card("Ensalada de lechuga").getByLabel("Ana: apta")).toBeVisible();
  await expect(card("Pan casero").getByLabel("Ana: con cuidado")).toBeVisible();
  await expect(page.getByLabel(/Beto:/)).toHaveCount(0);

  // El filtro "Apta para… Ana" oculta lo prohibido (lo que es "con cuidado" sigue visible).
  await page.getByRole("button", { name: "Apta para…" }).tap();
  await page.getByRole("group", { name: "Apta para" }).getByRole("button", { name: "Ana" }).tap();
  await expect(card("Tortilla de papas")).toHaveCount(0);
  await expect(card("Ensalada de lechuga")).toBeVisible();
  await expect(card("Pan casero")).toBeVisible();

  // Detalle: "Para quién va" con la razón concreta y el ingrediente resaltado.
  await page.goto(`/g/${casaId}/recetas/${tortilla}`);
  const forWhom = page.getByRole("region", { name: "Para quién va" });
  await expect(forWhom).toContainText("Ana");
  await expect(forWhom).toContainText("no apta");
  await expect(forWhom).toContainText("Tiene cebolla: Ana no come cebolla.");
  await expect(page.getByText("cebolla", { exact: true }).first()).toHaveClass(/text-danger-soft/);

  // Beto (sin perfil) ve las restricciones de Ana por ser del mismo grupo, pero no su resumen privado.
  const pageB = await (await mobileContext(browser)).newPage();
  await signIn(pageB, bEmail, password);
  await pageB.goto(`/g/${casaId}/recetas/${tortilla}`);
  await expect(pageB.getByRole("region", { name: "Para quién va" })).toContainText(
    "Tiene cebolla: Ana no come cebolla.",
  );
  await expect(pageB.getByText("información médica")).toHaveCount(0);
});

test("adaptar una receta: elegir persona, ver qué cambió y guardar la variante vinculada a la original", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const email = `adapt-ui-${Date.now()}@test.com`;
  const userId = await createTestUser(email, password, "Ana");
  const page = await (await mobileContext(browser)).newPage();
  await signIn(page, email, password);
  const groupId = page.url().split("/g/")[1]!.split("/")[0]!;
  await adminClient()
    .from("food_profiles")
    .insert({
      user_id: userId,
      data: {
        restrictions: [{ target: "cebolla", type: "ingredient", severity: "forbidden" }],
        goals: [],
        likes: [],
        dislikes: [],
        cuisines: [],
        schedule: {},
        equipment: [],
        skill: null,
        valid_until: null,
      },
    } as never);
  const original = await seedRecipe(email, password, groupId, {
    title: "Guiso con cebolla",
    ingredients: ["400 g de lentejas", "2 cebollas", "2 zanahorias"],
    steps: [
      { instruction: "Rehogá las cebollas.", minutes: 5 },
      { instruction: "Sumá las lentejas y cociná." },
    ],
  });

  await page.route("**/api/ai/recipes/*/adapt", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        titleSuffix: "sin cebolla",
        changes: ["Reemplacé las cebollas por hinojo y apio."],
        compat: [{ userId, name: "Ana", status: "ok" }],
        draft: {
          title: "Guiso con cebolla",
          servings: 2,
          tags: [],
          ingredients: [
            {
              raw_text: "400 g de lentejas",
              quantity: 400,
              unit: "g",
              name_canonical: "lenteja",
              position: 0,
              optional: false,
            },
            {
              raw_text: "1 bulbo de hinojo",
              quantity: 1,
              unit: "unidad",
              name_canonical: "hinojo",
              position: 1,
              optional: false,
            },
            {
              raw_text: "2 zanahorias",
              quantity: 2,
              unit: "unidad",
              name_canonical: "zanahoria",
              position: 2,
              optional: false,
            },
          ],
          steps: [
            {
              position: 0,
              instruction: "Rehogá el hinojo.",
              duration_seconds: 300,
              timer_kind: "active",
              tip: null,
            },
            {
              position: 1,
              instruction: "Sumá las lentejas y cociná.",
              duration_seconds: null,
              timer_kind: null,
              tip: null,
            },
          ],
        },
      }),
    }),
  );

  await page.goto(`/g/${groupId}/recetas/${original}`);
  await page.getByRole("button", { name: "Adaptar para…" }).tap();
  await expect(page.getByRole("button", { name: "Adaptar", exact: true })).toBeDisabled();
  await page.getByRole("group", { name: "Personas" }).getByRole("button", { name: "Ana" }).tap();
  await page.getByRole("button", { name: "Adaptar", exact: true }).tap();

  // Comparación: qué cambió y el diff original ↔ adaptada.
  await expect(page.getByText("Reemplacé las cebollas por hinojo y apio.")).toBeVisible();
  await expect(page.getByLabel("Ana: apta")).toBeVisible();
  await expect(page.getByText("1 bulbo de hinojo")).toBeVisible();
  await expect(page.getByLabel("Nombre de la variante")).toHaveValue(
    "Guiso con cebolla (sin cebolla)",
  );

  await page.getByRole("button", { name: "Guardar como variante" }).tap();
  await page.waitForURL(
    (url) => /\/recetas\/[0-9a-f-]{36}$/.test(url.pathname) && !url.pathname.endsWith(original),
  );
  await expect(
    page.getByRole("heading", { name: "Guiso con cebolla (sin cebolla)" }),
  ).toBeVisible();
  await expect(page.getByText(/Basada en/)).toContainText("Guiso con cebolla");

  // La original quedó intacta.
  await page.goto(`/g/${groupId}/recetas/${original}`);
  await expect(page.getByText("cebollas", { exact: true })).toBeVisible();
});
