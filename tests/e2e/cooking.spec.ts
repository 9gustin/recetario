import { expect, test } from "@playwright/test";
import { createTestUser, mobileContext, signIn } from "./helpers/auth";
import { seedRecipe } from "./helpers/recipes";

const password = "password123";

async function setup(browser: import("@playwright/test").Browser) {
  const email = `cook-${Date.now()}-${Math.floor(Math.random() * 1e4)}@test.com`;
  await createTestUser(email, password, "Ana");
  const ctx = await mobileContext(browser);
  const page = await ctx.newPage();
  await signIn(page, email, password);
  const groupId = page.url().split("/g/")[1]!.split("/")[0]!;
  const recipeId = await seedRecipe(email, password, groupId, {
    title: "Pollo al horno e2e",
    ingredients: ["400 g de pollo", "1 cda de aceite", "2 zapallitos"],
    steps: [
      { instruction: "Cortá el pollo en cubos.", minutes: 5 },
      { instruction: "Horneá el pollo.", minutes: 25, passive: true },
      { instruction: "Serví con los zapallitos." },
    ],
  });
  return { page, groupId, recipeId, email };
}

/** Simula que la app estuvo `ms` en segundo plano: adelanta el reloj de los timers guardados. */
async function elapseInBackground(page: import("@playwright/test").Page, ms: number) {
  await page.evaluate((delta) => {
    const raw = localStorage.getItem("recetario-timers");
    if (!raw) throw new Error("No hay timers guardados");
    const data = JSON.parse(raw) as {
      state: { timers: Record<string, { endsAt: number | null }> };
    };
    for (const t of Object.values(data.state.timers)) if (t.endsAt) t.endsAt -= delta;
    localStorage.setItem("recetario-timers", JSON.stringify(data));
  }, ms);
  await page.reload();
  // Al volver, la sesión a medias ofrece continuar: se elige "Continuar".
  const resume = page.getByRole("button", { name: "Continuar" });
  await resume.waitFor({ state: "visible", timeout: 5000 });
  await resume.tap();
}

test("modo cocinar: recorrido y timer pasivo con chip flotante", async ({ browser }) => {
  test.setTimeout(120_000);
  const { page, groupId, recipeId } = await setup(browser);

  await page.goto(`/g/${groupId}/recetas/${recipeId}/cocinar`);

  // Mise en place → paso 1 ("Listo" avanza) → paso 2.
  await expect(page.getByText("Mise en place")).toBeVisible();
  await page.getByRole("button", { name: "Empezar" }).tap();
  await expect(page.getByText("Paso 1 de 3")).toBeVisible();
  await page.getByRole("button", { name: "Listo" }).tap();
  await expect(page.getByText("Paso 2 de 3")).toBeVisible();

  // Timer del paso 2 (con o sin pedido de permiso de notificaciones).
  await page.getByRole("button", { name: "Iniciar" }).tap();
  const later = page.getByRole("button", { name: "Ahora no" });
  if (await later.isVisible().catch(() => false)) await later.tap();
  await expect(page.getByText("En marcha")).toBeVisible();
  await expect(page.getByText("Podés seguir con el próximo paso")).toBeVisible();

  // Sigue con el paso 3: el timer pasa a un chip flotante.
  await page.getByRole("button", { name: "Listo" }).tap();
  await expect(page.getByText("Paso 3 de 3")).toBeVisible();
  const chip = page.getByRole("button", { name: /Paso 2/ });
  await expect(chip).toBeVisible();
  await expect(chip).toContainText(/(25:00|24:5\d)/);

  // La pantalla estuvo bloqueada 1 minuto: al volver, el tiempo restante es correcto.
  await page.waitForTimeout(2000); // deja que se guarde el progreso (debounce de 1 s)
  await elapseInBackground(page, 60_000);
  await expect(chip).toContainText(/(24:0\d|23:5\d)/);

  // Terminó mientras no mirabas: al volver avisa (chip + toast que queda hasta cerrarlo).
  await elapseInBackground(page, 26 * 60_000);
  await expect(chip).toContainText("¡Listo!");
  await expect(page.getByText("¡Terminó el timer del paso 2!")).toBeVisible();

  // Tocar el chip lleva al paso del timer.
  await chip.tap();
  await expect(page.getByText("Paso 2 de 3")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Horneá el pollo." })).toBeVisible();
  await expect(page.getByText("¡Listo!", { exact: true })).toBeVisible();
});

test("modo cocinar: cerrar a mitad y volver retoma el mismo paso", async ({ browser }) => {
  test.setTimeout(120_000);
  const { page, groupId, recipeId } = await setup(browser);
  const url = `/g/${groupId}/recetas/${recipeId}/cocinar`;

  await page.goto(url);
  await page.getByRole("button", { name: "Más porciones" }).tap();
  await page.getByRole("button", { name: "Empezar" }).tap();
  await page.getByRole("button", { name: "Listo" }).tap();
  await expect(page.getByText("Paso 2 de 3")).toBeVisible();
  await page.waitForTimeout(2500); // el progreso se guarda con 1 s de debounce

  // "Cierra la PWA" y vuelve: ofrece seguir en el paso 2.
  await page.goto(`/g/${groupId}/recetas/${recipeId}`);
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Seguís en el paso 2" })).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).tap();
  await expect(page.getByText("Paso 2 de 3")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Horneá el pollo." })).toBeVisible();

  // "Empezar de nuevo" descarta la sesión: vuelve a la mise en place.
  await page.goto(`/g/${groupId}/recetas/${recipeId}`);
  await page.goto(url);
  await page.getByRole("button", { name: "Empezar de nuevo" }).tap();
  await expect(page.getByText("Mise en place")).toBeVisible();
  await page.waitForTimeout(1500);
  await page.goto(`/g/${groupId}/recetas/${recipeId}`);
  await page.goto(url);
  await expect(page.getByRole("heading", { name: /Seguís en el paso/ })).toHaveCount(0);
});

test("modo cocinar: ajustar un paso se ve al instante y no toca la receta", async ({ browser }) => {
  test.setTimeout(120_000);
  const { page, groupId, recipeId } = await setup(browser);
  const url = `/g/${groupId}/recetas/${recipeId}/cocinar`;

  await page.goto(url);
  await page.getByRole("button", { name: "Empezar" }).tap();
  await page.getByRole("button", { name: "Listo" }).tap();
  await expect(page.getByRole("heading", { name: "Horneá el pollo." })).toBeVisible();

  // Cambia la duración (25 → 30 min) y el texto del paso.
  await page.getByRole("button", { name: "Ajustar este paso" }).tap();
  await page.getByLabel(/Duración en minutos/).fill("30");
  await page.getByLabel("Texto del paso").fill("Horneá el pollo a 200 grados.");
  await page.getByRole("button", { name: "Guardar cambios" }).tap();
  await expect(page.getByRole("heading", { name: "Horneá el pollo a 200 grados." })).toBeVisible();
  await expect(page.getByText("30:00")).toBeVisible();

  // Agrega un paso después: ahora son 4.
  await page.getByRole("button", { name: "Ajustar este paso" }).tap();
  await page.getByRole("button", { name: "Agregar paso" }).tap();
  await page.getByLabel(/Paso nuevo/).fill("Dejá reposar 5 minutos.");
  await page.getByRole("button", { name: "Agregar paso" }).tap();
  await page.getByRole("button", { name: "Listo" }).tap();
  await expect(page.getByText("Paso 3 de 4")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dejá reposar 5 minutos." })).toBeVisible();
  await page.waitForTimeout(2500); // se guardan los ajustes en la sesión

  // Cierra y vuelve: los ajustes siguen aplicados.
  await page.goto(`/g/${groupId}/recetas/${recipeId}`);
  await expect(page.getByText("Horneá el pollo.", { exact: true })).toBeVisible(); // la receta no cambió
  await page.goto(url);
  await page.getByRole("button", { name: "Continuar" }).tap();
  await expect(page.getByText("Paso 3 de 4")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dejá reposar 5 minutos." })).toBeVisible();
});

// 1x1 PNG transparente.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test("modo cocinar: terminar guardando los cambios crea una versión 'mientras cocinabas'", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const { page, groupId, recipeId } = await setup(browser);
  const detailUrl = `/g/${groupId}/recetas/${recipeId}`;

  await page.goto(`${detailUrl}/cocinar`);
  await page.getByRole("button", { name: "Empezar" }).tap();

  // Paso 1: avanza con "Listo". Paso 2: ajusta la duración (25 → 30 min).
  await page.getByRole("button", { name: "Listo" }).tap();
  await expect(page.getByText("Paso 2 de 3")).toBeVisible();
  await page.getByRole("button", { name: "Ajustar este paso" }).tap();
  await page.getByLabel(/Duración en minutos/).fill("30");
  await page.getByRole("button", { name: "Guardar cambios" }).tap();
  await expect(page.getByText("30:00")).toBeVisible();

  // Pasa al paso 3 con "Listo" y al final con un tap en la zona derecha.
  await page.getByRole("button", { name: "Listo" }).tap();
  await expect(page.getByText("Paso 3 de 3")).toBeVisible();
  await page.getByRole("button", { name: "Paso siguiente" }).tap();

  // Pantalla final: resumen de cambios, puntaje, nota y foto.
  await expect(page.getByRole("heading", { name: "¡Listo!" })).toBeVisible();
  await expect(page.getByText("Cambiaste 1 cosa")).toBeVisible();
  await expect(page.getByText("Paso 2: 25 min → 30 min")).toBeVisible();
  await page.getByRole("button", { name: "4 estrellas" }).tap();
  await page.getByLabel("Nota para la próxima").fill("menos sal");
  await page
    .getByLabel("Foto del plato")
    .setInputFiles({ name: "plato.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("radio", { name: "Guardar en la receta" }).tap();
  await page.getByRole("button", { name: "Terminar" }).tap();

  // Vuelve al detalle: "La última vez" con puntaje y la nota.
  await page.waitForURL(detailUrl);
  await expect(page.getByText(/La última vez:/)).toBeVisible();
  await expect(page.getByText("menos sal")).toBeVisible();
  await expect(page.getByText("30 min", { exact: false }).first()).toBeVisible();

  // El cambio quedó como versión nueva con origen "mientras cocinabas".
  await page.goto(`${detailUrl}/historial`);
  await expect(page.getByText("Versión 2")).toBeVisible();
  await expect(page.getByText(/Mientras cocinabas/).first()).toBeVisible();
  await expect(page.getByText(/Ajustes mientras cocinabas/)).toBeVisible();

  // La sesión terminada ya no ofrece retomar.
  await page.goto(`${detailUrl}/cocinar`);
  await expect(page.getByRole("heading", { name: /Seguís en el paso/ })).toHaveCount(0);
});
