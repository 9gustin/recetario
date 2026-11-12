import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createTestUser, mobileContext, signIn } from "./helpers/auth";
import { createGroupAs, seedRecipe } from "./helpers/recipes";

const password = "password123";

/** Auditoría de accesibilidad (axe) de las pantallas principales en los tres temas (mediodía, tarde, noche). */
for (const daypart of ["mediodia", "tarde", "noche"] as const) {
  test(`accesibilidad (axe) en el tema ${daypart}`, async ({ browser }) => {
    test.setTimeout(150_000);
    const email = `a11y-${daypart}-${Date.now()}@test.com`;
    await createTestUser(email, password, "Ana");
    const groupId = await createGroupAs(email, password, "Casa");
    const recipeId = await seedRecipe(email, password, groupId, {
      title: "Pollo con papas",
      ingredients: ["500 g de pollo", "4 papas"],
      steps: [{ instruction: "Horneá." }],
    });
    const context = await mobileContext(browser);
    await context.addCookies([{ name: "daypart", value: daypart, url: "http://localhost:3000" }]);
    const page = await context.newPage();
    await signIn(page, email, password);

    const routes = [
      `/g/${groupId}/hoy`,
      `/g/${groupId}/recetas`,
      `/g/${groupId}/recetas/${recipeId}`,
      `/g/${groupId}/plan`,
      `/g/${groupId}/compras`,
      `/perfil`,
    ];
    const problems: string[] = [];
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .exclude("nextjs-portal")
        .analyze();
      for (const v of results.violations)
        problems.push(
          `${route} [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length}) → ${v.nodes[0]?.target.join(" ")}`,
        );
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });
}
