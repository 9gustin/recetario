/** Único lugar donde viven los IDs de modelo. */
export const MODELS = {
  /** Plan semanal, perfil alimentario, lectura de imágenes. */
  smart: "claude-sonnet-5-5",
  /** Transformaciones chicas: normalizar ingredientes, etiquetar, texto. */
  fast: "claude-haiku-5-5",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

/**
 * ¿El modelo acepta `tool_choice: { type: "tool" }` (forzar una herramienta)?
 * claude-sonnet-5-5 NO lo acepta (verificado contra la API): ahí se usa `auto` y se refuerza en el prompt.
 */
export const SUPPORTS_FORCED_TOOL: Record<ModelId, boolean> = {
  [MODELS.smart]: false,
  [MODELS.fast]: true,
};
