import { NextResponse } from "next/server";
import { z } from "zod";
import { checkQuota } from "@/lib/ai/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { COOKING_VOCAB_PROMPT, getTranscriber } from "@/lib/transcription";
import { isOwnAudioPath } from "@/lib/transcription/audio-path";

export const maxDuration = 60;

const bodySchema = z.object({ path: z.string().min(3).max(200) });
const MAX_BYTES = 20 * 1024 * 1024;

/** Transcribe un audio que la persona subió al bucket `audio` y lo borra (no se guarda). */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tenés que iniciar sesión." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isOwnAudioPath(parsed.data.path, user.id)) {
    return NextResponse.json({ error: "Audio inválido." }, { status: 400 });
  }
  const { path } = parsed.data;

  if (!(await checkQuota(user.id, "transcribe"))) {
    return NextResponse.json(
      { error: "Llegaste al límite de dictados de hoy. Probá mañana." },
      { status: 429 },
    );
  }

  const { data: blob, error: downloadError } = await supabase.storage.from("audio").download(path);
  if (downloadError || !blob)
    return NextResponse.json({ error: "No encontramos el audio." }, { status: 404 });
  if (blob.size > MAX_BYTES) {
    await supabase.storage.from("audio").remove([path]);
    return NextResponse.json({ error: "El audio es demasiado largo." }, { status: 413 });
  }

  try {
    const text = await getTranscriber().transcribe(blob, blob.type || "audio/webm", {
      language: "es",
      prompt: COOKING_VOCAB_PROMPT,
    });
    return NextResponse.json({ text });
  } catch (e) {
    console.error("transcribe failed", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "No pudimos transcribir el audio. Probá de nuevo." },
      { status: 502 },
    );
  } finally {
    // El audio no se conserva: ya tenemos el texto.
    await supabase.storage.from("audio").remove([path]);
  }
}
