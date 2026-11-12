/** Familias de alimentos del catálogo (`ingredients.family`) con su nombre para mostrar. */
export const FAMILY_LABELS: Record<string, string> = {
  allium: "Cebolla, ajo y puerro",
  lacteo: "Lácteos",
  cereal_gluten: "Gluten (trigo, cebada, avena)",
  cereal: "Cereales",
  carne_roja: "Carne roja",
  cerdo: "Cerdo",
  legumbre: "Legumbres",
  crucifera: "Crucíferas (brócoli, repollo)",
  solanacea: "Solanáceas (tomate, morrón, papa)",
  frutos_secos: "Frutos secos",
  citrico: "Cítricos",
  semilla: "Semillas",
  hoja_verde: "Hojas verdes",
  tuberculo: "Tubérculos",
  fruta: "Frutas",
};

/** Categorías amplias que la IA puede usar ("harinas refinadas") y a qué familias del catálogo equivalen. */
export const CATEGORY_FAMILIES: Record<string, string[]> = {
  harina: ["cereal_gluten", "cereal"],
  harinas: ["cereal_gluten", "cereal"],
  "harinas refinadas": ["cereal_gluten", "cereal"],
  gluten: ["cereal_gluten"],
  tacc: ["cereal_gluten"],
  lacteos: ["lacteo"],
  lactosa: ["lacteo"],
  "frutos secos": ["frutos_secos"],
  legumbres: ["legumbre"],
  crucíferas: ["crucifera"],
  "carne roja": ["carne_roja"],
};

export const familyLabel = (family: string) => FAMILY_LABELS[family] ?? family;
