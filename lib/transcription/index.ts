/** Interfaz común de los proveedores de voz → texto (intercambiables). */
export type TranscribeOptions = {
  language: "es";
  /** Vocabulario para que reconozca mejor los términos (cocina rioplatense). */
  prompt?: string;
};

export interface Transcriber {
  transcribe(audio: Blob, mime: string, opts: TranscribeOptions): Promise<string>;
}

/** Vocabulario de cocina argentina que mejora el reconocimiento. */
export const COOKING_VOCAB_PROMPT =
  "Receta de cocina argentina: zapallito, morrón, cebolla de verdeo, milanesa, cucharada, cucharadita, " +
  "taza, pizca, a gusto, horno, sartén, hervir, dorar, picar, rallar, fuego bajo.";

export function getTranscriber(): Transcriber {
  const provider = process.env.TRANSCRIPTION_PROVIDER ?? "openai";
  if (provider === "openai") {
    // Import diferido: no se carga si se usa otro proveedor.
    return {
      async transcribe(audio, mime, opts) {
        const { OpenAITranscriber } = await import("./openai");
        return new OpenAITranscriber().transcribe(audio, mime, opts);
      },
    };
  }
  throw new Error(`Proveedor de transcripción no soportado: ${provider}`);
}
