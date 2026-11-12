import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractJsonLdRecipe, parseIsoDuration } from "./json-ld";
import { extractMainText } from "./text";

const fixture = (name: string) => readFileSync(`tests/fixtures/recipes/${name}`, "utf8");

describe("parseIsoDuration", () => {
  it.each([
    ["PT10M", 10],
    ["PT1H30M", 90],
    ["PT1H", 60],
    ["P1DT2H", 1560],
    ["PT90S", 2],
    ["PT0M", null],
    ["10 minutos", null],
  ])("%s → %s", (value, expected) => expect(parseIsoDuration(value)).toBe(expected));
});

describe("extractJsonLdRecipe", () => {
  it("lee una receta con JSON-LD simple", () => {
    const r = extractJsonLdRecipe(fixture("json-ld-simple.html"), "https://ejemplo.com/pollo")!;
    expect(r.title).toBe("Pollo al limón con zapallitos");
    expect(r.servings).toBe(4);
    expect([r.prep_minutes, r.cook_minutes, r.total_minutes]).toEqual([10, 25, 35]);
    expect(r.image_url).toBe("https://ejemplo.com/pollo.jpg");
    expect(r.source_url).toBe("https://ejemplo.com/pollo");
    expect(r.tags).toEqual(expect.arrayContaining(["Principal", "pollo", "rápida"]));
    expect(r.ingredients).toHaveLength(5);
    expect(r.ingredients?.[0]).toMatchObject({
      quantity: 400,
      unit: "g",
      name_canonical: "pechuga de pollo",
    });
    expect(r.steps?.map((s) => s.instruction)).toEqual([
      "Cortá el pollo en cubos y salpimentalo.",
      "Doralo en la sartén con el aceite.",
      "Sumá los zapallitos y el jugo de limón; cociná 10 minutos.",
    ]);
  });

  it("encuentra la receta dentro de @graph, con @type múltiple y secciones de pasos", () => {
    const r = extractJsonLdRecipe(fixture("json-ld-graph.html"))!;
    expect(r.title).toBe("Tarta de zapallo y queso");
    expect(r.servings).toBe(6);
    expect(r.total_minutes).toBe(75);
    expect(r.image_url).toBe("https://ejemplo.com/tarta.jpg");
    expect(r.ingredients).toHaveLength(4);
    expect(r.steps).toHaveLength(3);
    expect(r.steps?.[2]?.instruction).toContain("hornear 40 minutos");
  });

  it("devuelve null si la página no tiene JSON-LD de receta", () => {
    expect(extractJsonLdRecipe(fixture("no-json-ld.html"))).toBeNull();
    expect(
      extractJsonLdRecipe("<script type='application/ld+json'>{no es json}</script>"),
    ).toBeNull();
  });

  it("parte una sola cadena de pasos numerados en varios pasos", () => {
    const html = `<script type="application/ld+json">{"@type":"Recipe","name":"X","recipeIngredient":["1 huevo"],"recipeInstructions":"1. Batir.\\n2. Cocinar."}</script>`;
    expect(extractJsonLdRecipe(html)?.steps?.map((s) => s.instruction)).toEqual([
      "Batir.",
      "Cocinar.",
    ]);
  });
});

describe("extractMainText", () => {
  it("deja solo el contenido principal, sin menú, pie ni scripts", () => {
    const text = extractMainText(fixture("no-json-ld.html"));
    expect(text).toContain("Milanesas de berenjena");
    expect(text).toContain("2 berenjenas");
    expect(text).toContain("Cocinarlas al horno 25 minutos");
    expect(text).not.toContain("Inicio");
    expect(text).not.toContain("analytics");
    expect(text).not.toContain("derechos reservados");
  });

  it("trunca a ~15 mil caracteres", () => {
    expect(
      extractMainText(`<body><main>${"palabra ".repeat(10_000)}</main></body>`).length,
    ).toBeLessThanOrEqual(15_000);
  });
});
