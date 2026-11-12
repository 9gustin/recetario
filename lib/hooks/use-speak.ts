"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "recetario-speak";

/** Elige una voz en español: es-AR si existe, si no cualquier es-*. */
export function pickSpanishVoice(voices: { lang: string }[]): number {
  const exact = voices.findIndex((v) => v.lang.toLowerCase().replace("_", "-") === "es-ar");
  if (exact >= 0) return exact;
  return voices.findIndex((v) => v.lang.toLowerCase().startsWith("es"));
}

/** Lee respuestas en voz alta con `speechSynthesis` (opt-in, se recuerda). */
export function useSpeak() {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  // El toggle solo se muestra con el panel abierto (cliente), así que se puede leer al iniciar.
  const [enabled, setEnabledState] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  });

  const cancel = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  const setEnabled = useCallback(
    (value: boolean) => {
      setEnabledState(value);
      try {
        localStorage.setItem(KEY, value ? "1" : "0");
      } catch {
        // sin localStorage
      }
      if (!value) cancel();
    },
    [cancel],
  );

  const speak = useCallback(
    (text: string) => {
      if (!supported || !enabled || !text.trim()) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const index = pickSpanishVoice(voices);
      if (index >= 0) utterance.voice = voices[index]!;
      utterance.lang = voices[index]?.lang ?? "es-AR";
      window.speechSynthesis.speak(utterance);
    },
    [enabled, supported],
  );

  // Se corta al salir.
  useEffect(() => cancel, [cancel]);

  return { supported, enabled, setEnabled, speak, cancel };
}
