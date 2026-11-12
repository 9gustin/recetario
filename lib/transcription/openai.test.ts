import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAITranscriber, extensionFor } from "./openai";

afterEach(() => vi.unstubAllGlobals());

describe("extensionFor", () => {
  it.each([
    ["audio/webm;codecs=opus", "webm"],
    ["audio/mp4", "mp4"],
    ["audio/ogg; codecs=opus", "ogg"],
    ["audio/desconocido", "webm"],
  ])("%s → %s", (mime, ext) => expect(extensionFor(mime)).toBe(ext));
});

describe("OpenAITranscriber", () => {
  it("manda el audio con modelo, idioma y vocabulario, y devuelve el texto", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ text: "  dos zapallitos y un morrón " })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const text = await new OpenAITranscriber("sk-test").transcribe(
      new Blob(["x"]),
      "audio/webm;codecs=opus",
      {
        language: "es",
        prompt: "zapallito",
      },
    );

    expect(text).toBe("dos zapallitos y un morrón");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    const form = init.body as FormData;
    expect(form.get("model")).toBe("gpt-4o-transcribe");
    expect(form.get("language")).toBe("es");
    expect(form.get("prompt")).toBe("zapallito");
    expect((form.get("file") as File).name).toBe("audio.webm");
  });

  it("falla con un error claro si la API responde mal o falta la clave", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("rate limited", { status: 429 })),
    );
    await expect(
      new OpenAITranscriber("sk-test").transcribe(new Blob(["x"]), "audio/mp4", { language: "es" }),
    ).rejects.toThrow(/429/);
    await expect(
      new OpenAITranscriber("").transcribe(new Blob(["x"]), "audio/mp4", { language: "es" }),
    ).rejects.toThrow(/OPENAI_API_KEY/);
  });
});
