/**
 * Genera el catálogo de recetas públicas con IA (originales, rápidas, en español rioplatense).
 * Escribe un archivo por pedido en data/catalog/batches/ (se puede cortar y retomar).
 *
 *   pnpm catalog:generate              # todos los pedidos que falten
 *   pnpm catalog:generate desayuno-5min pollo-30   # solo esos
 *   CATALOG_CONCURRENCY=4 pnpm catalog:generate
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { getAnthropic } from "@/lib/ai/client";
import { MODELS } from "@/lib/ai/models";
import { parseIngredientLine } from "@/lib/domain/ingredient-line";
import { BRIEFS, type Brief } from "./briefs";

process.loadEnvFile(".env.local");

const DIR = path.join(process.cwd(), "data/catalog/batches");
const PER_BRIEF = 10;

export const TAGS = [
  "rápido",
  "liviano",
  "vegetariano",
  "vegano",
  "sin gluten",
  "sin lácteos",
  "económico",
  "para freezar",
  "una olla",
  "airfryer",
  "sin horno",
  "horno",
  "desayuno",
  "almuerzo",
  "cena",
  "merienda",
  "snack",
  "postre",
  "bebida",
  "ensalada",
  "sopa",
  "pasta",
  "arroz",
  "carne",
  "cerdo",
  "pollo",
  "pescado",
  "huevo",
  "legumbres",
  "verdura",
  "salsa",
  "guarnición",
  "tarta",
  "empanada",
  "milanesa",
  "sándwich",
  "guiso",
  "salteado",
  "fruta",
  "para chicos",
  "para compartir",
  "sobras",
  "bajo en carbohidratos",
  "alto en proteína",
  "argentina",
  "italiana",
  "mexicana",
  "asiática",
  "mediterránea",
  "india",
  "latinoamericana",
  "árabe",
  "española",
  "verano",
  "invierno",
  "una bandeja",
] as const;

export const recipeSchema = z.object({
  title: z.string().trim().min(3).max(90),
  description: z.string().trim().min(10).max(240),
  servings: z.number().int().min(1).max(12),
  prep_minutes: z.number().int().min(0).max(120),
  cook_minutes: z.number().int().min(0).max(180),
  difficulty: z.enum(["facil", "media", "dificil"]),
  tags: z.array(z.string()).min(1).max(8),
  ingredients: z.array(z.string().trim().min(2).max(120)).min(3).max(22),
  steps: z
    .array(
      z.object({
        instruction: z.string().trim().min(10).max(500),
        minutes: z.number().int().min(1).max(240).nullish(),
        passive: z.boolean().nullish(),
      }),
    )
    .min(2)
    .max(12),
  storage: z.object({
    fridge_days: z.number().int().min(0).max(5),
    freezer_days: z.number().int().min(0).max(120).nullable(),
    reheat: z.string().max(160),
    tip: z.string().max(160).nullable(),
  }),
});
export type CatalogRecipe = z.infer<typeof recipeSchema>;
const batchSchema = z.object({ recipes: z.array(z.unknown()) });

const SYSTEM = `Sos un cocinero argentino que arma un catálogo público de recetas caseras. Escribí recetas ORIGINALES (no copies textos de libros ni de sitios), en español rioplatense con voseo, claras y probables en una cocina de casa.

Reglas:
- Cada ingrediente en una línea con cantidad y unidad cuando corresponde: "500 g de pechuga de pollo", "2 zanahorias", "1 cda de aceite de oliva", "sal a gusto". Unidades válidas: g, kg, ml, l, cda, cdita, taza, unidad, diente, atado, lata, paquete, feta, pizca. Nombres de ingredientes comunes en Argentina.
- Pasos cortos, con un verbo por acción; poné minutes en los pasos con espera (y passive=true si podés hacer otra cosa mientras).
- total = prep + cook; respetá el tiempo máximo del pedido.
- tags: elegí SOLO de esta lista: ${TAGS.join(", ")}.
- Recetas distintas entre sí (técnica, ingrediente principal y sabor). Nada de marcas. Nada de recetas médicas o de dietas terapéuticas.
- storage: cuánto dura cocida en la heladera (conservador, máx. 4 días), si se puede freezar, cómo recalentar y un consejo corto.
Respondé llamando a la herramienta.`;

const tool = {
  name: "entregar_recetas",
  description: "Entrega las recetas del pedido.",
  input_schema: z.toJSONSchema(z.object({ recipes: z.array(recipeSchema) })) as never,
};

function normalizeTitle(t: string) {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Chequeos por código: ingredientes parseables, tiempos y tags válidos. Devuelve el motivo si se descarta. */
export function checkRecipe(r: CatalogRecipe, maxMinutes: number): string | null {
  if (r.prep_minutes + r.cook_minutes > Math.max(maxMinutes + 15, 20)) return "tarda demasiado";
  if (r.prep_minutes + r.cook_minutes === 0) return "sin tiempo";
  for (const line of r.ingredients) {
    const p = parseIngredientLine(line);
    if (!p.name || p.name.length < 2) return `ingrediente ilegible: ${line}`;
  }
  const allowed = new Set<string>(TAGS);
  if (!r.tags.some((t) => allowed.has(t))) return "sin tags válidos";
  if (/\b(marca|®|™)\b/i.test(JSON.stringify(r))) return "menciona marcas";
  return null;
}

async function generate(brief: Brief, avoid: string[]): Promise<CatalogRecipe[]> {
  const res = await getAnthropic().messages.create({
    model: MODELS.smart,
    max_tokens: 12000,
    system: SYSTEM,
    tools: [tool],
    messages: [
      {
        role: "user",
        content: `Pedido: ${PER_BRIEF} recetas de ${brief.text}. Tiempo total máximo: ${brief.maxMinutes} minutos. Tags sugeridos: ${brief.tags.join(", ")}.${
          avoid.length
            ? `\nYa existen estas (no las repitas ni hagas variantes casi iguales): ${avoid.slice(0, 120).join("; ")}.`
            : ""
        }`,
      },
    ],
  });
  const use = res.content.find((b) => b.type === "tool_use");
  if (!use || use.type !== "tool_use") return [];
  const raw = batchSchema.safeParse(use.input);
  if (!raw.success) return [];
  const out: CatalogRecipe[] = [];
  for (const item of raw.data.recipes) {
    const parsed = recipeSchema.safeParse(item);
    if (!parsed.success) continue;
    const why = checkRecipe(parsed.data, brief.maxMinutes);
    if (why) {
      console.log(`  descartada "${parsed.data.title}": ${why}`);
      continue;
    }
    out.push(parsed.data);
  }
  return out;
}

async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  const only = process.argv.slice(2);
  const todo = BRIEFS.filter((b) =>
    only.length ? only.includes(b.id) : !fs.existsSync(path.join(DIR, `${b.id}.json`)),
  );
  console.log(`${todo.length} pedidos (${todo.length * PER_BRIEF} recetas aprox.)`);

  // Títulos ya generados, para no repetir entre pedidos.
  const seen = new Set<string>();
  for (const f of fs.readdirSync(DIR))
    for (const r of JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) as CatalogRecipe[])
      seen.add(normalizeTitle(r.title));

  const concurrency = Number(process.env.CATALOG_CONCURRENCY ?? 4);
  let next = 0;
  let total = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < todo.length) {
        const brief = todo[next++]!;
        try {
          const recipes = (await generate(brief, [...seen].slice(-150))).filter((r) => {
            const k = normalizeTitle(r.title);
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
          fs.writeFileSync(path.join(DIR, `${brief.id}.json`), JSON.stringify(recipes, null, 2));
          total += recipes.length;
          console.log(`✓ ${brief.id}: ${recipes.length} recetas (acumulado ${total})`);
        } catch (e) {
          console.log(`✗ ${brief.id}: ${e instanceof Error ? e.message : e}`);
        }
      }
    }),
  );
  console.log(`Listo: ${total} recetas nuevas.`);
}

if (process.argv[1]?.includes("generate"))
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
