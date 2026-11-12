"use client";

import { useState } from "react";
import { Loader2, Mic, Square, X } from "lucide-react";
import { PillButton } from "@/components/shared/pill-button";
import { Textarea } from "@/components/ui/textarea";
import { formatClock } from "@/lib/domain/cooking-display";
import { MAX_RECORDING_SECONDS, useRecorder } from "@/lib/hooks/use-recorder";
import { extensionFor } from "@/lib/transcription/openai";
import { createClient } from "@/lib/supabase/client";

type Props = {
  /** Se llama con el texto ya revisado por la persona. */
  onTranscript: (text: string) => void;
  confirmLabel?: string;
  idleLabel?: string;
};

type Phase = "record" | "working" | "review";

/** Botón grande de dictado: graba, sube, transcribe y deja editar el texto antes de usarlo. */
export function VoiceRecorder({
  onTranscript,
  confirmLabel = "Usar este texto",
  idleLabel = "Tocá para hablar",
}: Props) {
  const recorder = useRecorder();
  const [phase, setPhase] = useState<Phase>("record");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function finishRecording() {
    const audio = await recorder.stop();
    if (!audio) return;
    setPhase("working");
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Tenés que iniciar sesión.");
      const path = `${user.id}/${crypto.randomUUID()}.${extensionFor(audio.mime)}`;
      const { error: uploadError } = await supabase.storage.from("audio").upload(path, audio.blob, {
        contentType: audio.mime.split(";")[0],
      });
      if (uploadError) throw new Error("No pudimos subir el audio. Probá de nuevo.");

      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const body = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? "No pudimos transcribir el audio.");
      if (!body.text)
        throw new Error("No escuchamos nada. Probá de nuevo, más cerca del micrófono.");
      setText(body.text);
      setPhase("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo salió mal. Probá de nuevo.");
      setPhase("record");
    }
  }

  if (phase === "review") {
    return (
      <div className="flex flex-col gap-3">
        <label htmlFor="voice-text" className="text-sm font-medium">
          Esto es lo que escuchamos. Podés corregirlo.
        </label>
        <Textarea
          id="voice-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-40 text-base"
        />
        <PillButton disabled={!text.trim()} onClick={() => onTranscript(text.trim())}>
          {confirmLabel}
        </PillButton>
        <PillButton
          variant="outline"
          size="md"
          onClick={() => {
            setText("");
            setPhase("record");
          }}
        >
          Grabar de nuevo
        </PillButton>
      </div>
    );
  }

  const recording = recorder.status === "recording";
  const busy = phase === "working" || recorder.status === "requesting";
  const message = error ?? recorder.error;

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="relative flex size-28 items-center justify-center">
        {recording ? (
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-accent/30"
            style={{
              transform: `scale(${1 + recorder.level * 0.45})`,
              transition: "transform 80ms linear",
            }}
          />
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => (recording ? void finishRecording() : void recorder.start())}
          aria-label={recording ? "Terminar de grabar" : idleLabel}
          className="relative flex size-24 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="size-9 animate-spin" aria-hidden="true" />
          ) : recording ? (
            <Square className="size-8" fill="currentColor" aria-hidden="true" />
          ) : (
            <Mic className="size-10" aria-hidden="true" />
          )}
        </button>
      </div>

      <p className="text-center text-sm font-medium" aria-live="polite">
        {phase === "working"
          ? "Transcribiendo…"
          : recording
            ? `Grabando ${formatClock(recorder.seconds)} de ${formatClock(MAX_RECORDING_SECONDS)} · tocá para terminar`
            : idleLabel}
      </p>

      {recording ? (
        <PillButton variant="outline" size="md" onClick={() => recorder.cancel()}>
          <X /> Cancelar
        </PillButton>
      ) : null}

      {message ? (
        <p role="alert" className="max-w-xs text-center text-sm text-danger-soft">
          {message}
        </p>
      ) : null}
    </div>
  );
}
