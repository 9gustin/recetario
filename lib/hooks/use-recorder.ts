"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Formatos por orden de preferencia: webm/opus en Android y desktop, mp4 en iOS. */
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
] as const;

export const MAX_RECORDING_SECONDS = 5 * 60;

export function pickMimeType(isSupported: (mime: string) => boolean): string | null {
  return MIME_CANDIDATES.find((m) => isSupported(m)) ?? null;
}

export type RecorderStatus = "idle" | "requesting" | "recording";
export type RecordedAudio = { blob: Blob; mime: string };

function friendlyError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "No tenemos permiso para usar el micrófono. Habilitalo en los ajustes del navegador.";
  }
  if (name === "NotFoundError") return "No encontramos un micrófono en este dispositivo.";
  return "No pudimos empezar a grabar. Probá de nuevo.";
}

/** Graba audio con MediaRecorder: tiempo, nivel de volumen (para animar el botón), límite de 5 min y cancelar. */
export function useRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const raf = useRef<number | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const finish = useRef<((audio: RecordedAudio | null) => void) | null>(null);

  const cleanup = useCallback(() => {
    if (tick.current) clearInterval(tick.current);
    if (raf.current) cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    void audioCtx.current?.close().catch(() => {});
    tick.current = raf.current = null;
    stream.current = null;
    audioCtx.current = null;
    recorder.current = null;
    setSeconds(0);
    setLevel(0);
    setStatus("idle");
  }, []);

  useEffect(() => cleanup, [cleanup]);

  /** Detiene y devuelve el audio (null si se canceló). */
  const stop = useCallback(
    () =>
      new Promise<RecordedAudio | null>((resolve) => {
        const r = recorder.current;
        if (!r || r.state === "inactive") return resolve(null);
        finish.current = resolve;
        r.stop();
      }),
    [],
  );

  const cancel = useCallback(() => {
    finish.current = null;
    const r = recorder.current;
    if (r && r.state !== "inactive") {
      r.onstop = null;
      r.stop();
    }
    chunks.current = [];
    cleanup();
  }, [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Tu navegador no permite grabar audio.");
      return;
    }
    setStatus("requesting");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const mime = pickMimeType((m) => MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(media, mime ? { mimeType: mime } : undefined);
      recorder.current = rec;
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      rec.onstop = () => {
        const type = rec.mimeType || mime || "audio/webm";
        const blob = new Blob(chunks.current, { type });
        chunks.current = [];
        const done = finish.current;
        finish.current = null;
        cleanup();
        done?.({ blob, mime: type });
      };
      rec.start();

      // Nivel de volumen para animar el botón.
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor();
      audioCtx.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(media).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const loop = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        setLevel(Math.min(1, Math.sqrt(sum / data.length) * 3));
        raf.current = requestAnimationFrame(loop);
      };
      loop();

      setStatus("recording");
      setSeconds(0);
      tick.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_RECORDING_SECONDS && rec.state === "recording") rec.stop();
          return s + 1;
        });
      }, 1000);
    } catch (e) {
      cleanup();
      setError(friendlyError(e));
    }
  }, [cleanup]);

  return { status, seconds, level, error, start, stop, cancel };
}
