import type { SeedRecipe } from "../../e2e/helpers/recipes";

const step = [{ instruction: "Cociná todo junto hasta que esté listo." }];
const r = (
  title: string,
  ingredients: string[],
  totalMinutes: number,
  tags: string[] = [],
): SeedRecipe => ({ title, ingredients, steps: step, totalMinutes, tags, servings: 4 });

/** 25 recetas de prueba; las 6 con cebolla están marcadas con `onion: true`. */
export const PLAN_RECIPES: (SeedRecipe & { onion?: boolean })[] = [
  { ...r("Tortilla de papas", ["4 papas", "5 huevos", "1 cebolla"], 35), onion: true },
  {
    ...r("Guiso de lentejas", ["2 tazas de lentejas", "1 cebolla", "2 zanahorias", "1 papa"], 50),
    onion: true,
  },
  { ...r("Pollo al horno con papas", ["1 pollo", "4 papas", "1 cebolla"], 70), onion: true },
  { ...r("Milanesas de carne con puré", ["500 g de bola de lomo", "2 huevos", "4 papas"], 40) },
  {
    ...r(
      "Salpicón de pollo",
      ["300 g de pechuga de pollo", "2 tomates", "1 cebolla", "2 papas"],
      30,
    ),
    onion: true,
  },
  {
    ...r("Empanadas de carne", ["500 g de carne picada", "1 cebolla", "12 tapas de empanada"], 60),
    onion: true,
  },
  {
    ...r("Ensalada de lechuga y tomate", ["1 lechuga", "2 tomates", "1 zanahoria"], 10, [
      "liviano",
    ]),
  },
  { ...r("Fideos con tuco", ["400 g de fideos", "4 tomates", "2 dientes de ajo"], 30) },
  {
    ...r(
      "Merluza al horno con verduras",
      ["4 filetes de merluza", "2 zapallitos", "1 morrón", "1 limón"],
      35,
      ["pescado"],
    ),
  },
  {
    ...r(
      "Salmón con ensalada de rúcula",
      ["4 trozos de salmón", "1 atado de rúcula", "1 limón"],
      25,
      ["pescado", "liviano"],
    ),
  },
  {
    ...r(
      "Tarta de zapallitos",
      ["3 zapallitos", "3 huevos", "1 tapa de tarta", "100 g de queso"],
      45,
    ),
  },
  { ...r("Revuelto de zapallitos", ["3 zapallitos", "4 huevos"], 15, ["rápido", "liviano"]) },
  {
    ...r(
      "Pechuga a la plancha con ensalada",
      ["4 pechugas de pollo", "1 lechuga", "2 tomates"],
      20,
      ["rápido", "liviano"],
    ),
  },
  {
    ...r("Bife de chorizo con ensalada", ["4 bifes de chorizo", "1 lechuga", "2 tomates"], 20, [
      "rápido",
    ]),
  },
  {
    ...r(
      "Hamburguesas caseras",
      ["500 g de carne picada", "4 panes de hamburguesa", "1 tomate", "1 lechuga"],
      25,
    ),
  },
  {
    ...r(
      "Risotto de hongos",
      ["300 g de arroz", "200 g de champiñones", "100 g de queso rallado"],
      40,
    ),
  },
  { ...r("Arroz con pollo", ["1 pollo", "2 tazas de arroz", "1 morrón", "2 dientes de ajo"], 55) },
  {
    ...r(
      "Wok de verduras y pollo",
      ["300 g de pollo", "1 zanahoria", "1 zapallito", "1 morrón"],
      25,
      ["rápido"],
    ),
  },
  {
    ...r("Ñoquis con salsa de tomate", ["1 kg de ñoquis", "4 tomates", "2 dientes de ajo"], 25, [
      "rápido",
    ]),
  },
  { ...r("Pizza casera", ["500 g de harina", "300 g de muzzarella", "3 tomates"], 60) },
  {
    ...r(
      "Omelette de espinaca y queso",
      ["4 huevos", "1 atado de espinaca", "100 g de queso"],
      15,
      ["rápido", "liviano"],
    ),
  },
  { ...r("Sopa de calabaza", ["1 kg de calabaza", "1 papa", "1 zanahoria"], 40, ["liviano"]) },
  {
    ...r("Pescado a la romana", ["4 filetes de merluza", "2 huevos", "1 taza de pan rallado"], 30, [
      "pescado",
    ]),
  },
  {
    ...r("Ensalada de lentejas", ["2 tazas de lentejas", "1 tomate", "1 morrón", "1 limón"], 30, [
      "liviano",
    ]),
  },
  {
    ...r(
      "Canelones de verdura",
      ["12 panqueques", "1 atado de espinaca", "200 g de ricota", "3 tomates"],
      60,
    ),
  },
];

export const PLAN_REQUESTS = [
  "Armame los almuerzos y las cenas de lunes a viernes.",
  "Armame la semana completa, almuerzos y cenas, de lunes a domingo.",
  "Solo cenas de lunes a viernes, rápidas.",
  "Armame almuerzos y cenas de lunes a viernes con pescado dos veces.",
  "Quiero una semana liviana: almuerzos y cenas de lunes a viernes, con muchas verduras.",
  "Armame cenas de lunes a domingo y el sábado al mediodía que sea algo especial.",
  "Almuerzos y cenas de lunes a viernes. El jueves comemos afuera.",
  "Armame la semana de lunes a viernes, pero que las recetas de menos de 30 minutos.",
];
