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
