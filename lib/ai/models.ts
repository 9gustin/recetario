/** Único lugar donde viven los IDs de modelo. */
export const MODELS = {
  /** Plan semanal, perfil alimentario, lectura de imágenes. */
  smart: "claude-sonnet-5-5",
  /** Transformaciones chicas: normalizar ingredientes, etiquetar, texto. */
  fast: "claude-haiku-5-5",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];
