/** Recetario, catálogo y perfil de prueba para los evals del asistente (sin base de datos). */

export type FixtureRecipe = {
  id: string;
  title: string;
  servings: number;
  total_minutes: number;
  tags: string[];
  ingredients: string[];
  steps: { instruction: string; duration_seconds: number | null }[];
};

export const RECIPES: FixtureRecipe[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Pollo al limón con zapallitos",
    servings: 4,
    total_minutes: 35,
    tags: ["rápida", "pollo"],
    ingredients: [
      "400 g de pechuga de pollo",
      "3 zapallitos",
      "1 limón",
      "2 cdas de aceite de oliva",
      "sal y pimienta",
    ],
    steps: [
      { instruction: "Cortá el pollo en cubos y salpimentalo.", duration_seconds: null },
      {
        instruction: "Dorá el pollo en la sartén bien caliente con el aceite, sin moverlo.",
        duration_seconds: 300,
      },
      {
        instruction: "Sumá los zapallitos cortados en rodajas y cociná tapado.",
        duration_seconds: 600,
      },
      { instruction: "Exprimí el limón por encima, probá la sal y serví.", duration_seconds: null },
    ],
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    title: "Salmón con rúcula y palta",
    servings: 2,
    total_minutes: 25,
    tags: ["pescado", "rápida"],
    ingredients: [
      "2 filetes de salmón",
      "1 atado de rúcula",
      "1 palta",
      "1 limón",
      "aceite de oliva",
      "sal",
    ],
    steps: [
      {
        instruction: "Salá los filetes y sellalos en la plancha, primero del lado de la piel.",
        duration_seconds: 360,
      },
      {
        instruction: "Cortá la palta y mezclala con la rúcula y el limón.",
        duration_seconds: null,
      },
      { instruction: "Serví el salmón sobre la ensalada.", duration_seconds: null },
    ],
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    title: "Ensalada de repollo",
    servings: 4,
    total_minutes: 15,
    tags: ["ensalada", "fría"],
    ingredients: ["1/4 de repollo", "2 zanahorias", "1 limón", "aceite de oliva", "sal"],
    steps: [
      { instruction: "Cortá el repollo bien fino y rallá las zanahorias.", duration_seconds: null },
      {
        instruction: "Mezclá todo con limón, aceite y sal, y dejá reposar.",
        duration_seconds: 600,
      },
    ],
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    title: "Puré de calabaza",
    servings: 4,
    total_minutes: 30,
    tags: ["guarnición"],
    ingredients: ["1 kg de calabaza", "2 cdas de manteca", "nuez moscada", "sal"],
    steps: [
      { instruction: "Pelá la calabaza y cortala en cubos.", duration_seconds: null },
      { instruction: "Hervila hasta que esté tierna.", duration_seconds: 1200 },
      { instruction: "Escurrí y pisala con la manteca y la nuez moscada.", duration_seconds: null },
    ],
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    title: "Tarta de zapallo y queso",
    servings: 6,
    total_minutes: 75,
    tags: ["horno", "vegetariana"],
    ingredients: [
      "1 kg de zapallo",
      "2 tapas de tarta",
      "200 g de queso cremoso",
      "2 huevos",
      "1 cebolla",
    ],
    steps: [
      { instruction: "Hervir el zapallo y hacerlo puré.", duration_seconds: 1200 },
      {
        instruction: "Rehogar la cebolla y mezclarla con el puré, el queso y los huevos.",
        duration_seconds: null,
      },
      { instruction: "Rellenar la tarta y hornear a 180 grados.", duration_seconds: 2400 },
    ],
  },
];

/** Perfil de prueba de la persona que pregunta. */
export const PROFILE = {
  forbidden: ["cebolla", "cebolla de verdeo", "maní"],
  limited: [{ target: "harinas refinadas", rule: "evitar en la cena" }],
  summary:
    "Restricciones de la persona: NO puede comer cebolla (ni cebolla de verdeo) por un tratamiento ni maní (alergia). Evita las harinas refinadas a la noche.",
};

export const CATALOG: Record<string, { shelf_life: string; storage_tips: string }> = {
  "pollo cocido": {
    shelf_life: "heladera 3 a 4 días; freezer 2 a 3 meses",
    storage_tips: "Guardarlo en recipiente hermético apenas se enfría.",
  },
  "arroz cocido": {
    shelf_life: "heladera 3 a 4 días; freezer 1 mes",
    storage_tips: "Enfriarlo rápido; no dejarlo a temperatura ambiente más de 1 hora.",
  },
  "huevo duro": {
    shelf_life: "heladera con cáscara hasta 7 días",
    storage_tips: "Guardarlos sin pelar.",
  },
  "salsa de tomate": {
    shelf_life: "abierta en heladera 5 a 7 días; freezer 3 meses",
    storage_tips: "Frasco hermético.",
  },
  zapallito: {
    shelf_life: "heladera crudo 5 a 7 días; cocido 3 días",
    storage_tips: "Se pone aguado al descongelar.",
  },
  salmón: { shelf_life: "heladera cocido 2 días", storage_tips: "Consumir rápido." },
};
