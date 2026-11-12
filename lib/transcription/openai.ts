import type { Transcriber, TranscribeOptions } from "./index";

const ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";
export const OPENAI_TRANSCRIBE_MODEL = "gpt-4o-transcribe";

const EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-m4a": "m4a",
};

/** "audio/webm;codecs=opus" → "webm". */
export function extensionFor(mime: string): string {
  return EXTENSIONS[mime.split(";")[0]?.trim().toLowerCase() ?? ""] ?? "webm";
}

export class OpenAITranscriber implements Transcriber {
  constructor(private readonly apiKey = process.env.OPENAI_API_KEY) {}

  async transcribe(audio: Blob, mime: string, opts: TranscribeOptions): Promise<string> {
    if (!this.apiKey) throw new Error("Falta OPENAI_API_KEY");
    const form = new FormData();
    form.set(
      "file",
      new File([audio], `audio.${extensionFor(mime)}`, { type: mime.split(";")[0] }),
    );
    form.set("model", OPENAI_TRANSCRIBE_MODEL);
    form.set("language", opts.language);
    form.set("response_format", "json");
    if (opts.prompt) form.set("prompt", opts.prompt);

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });
    if (!res.ok) {
      throw new Error(
        `OpenAI transcripción falló (${res.status}): ${(await res.text()).slice(0, 200)}`,
      );
    }
    const json = (await res.json()) as { text?: string };
    return (json.text ?? "").trim();
  }
}
