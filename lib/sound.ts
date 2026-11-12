/** Sonido de alarma generado con Web Audio (sin archivos externos). Solo en el cliente. */

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  return ctx;
}

/** Hay que llamarlo desde un gesto del usuario (ej. al iniciar un timer): los navegadores lo exigen. */
export function unlockAudio() {
  const c = getContext();
  if (c && c.state === "suspended") void c.resume();
}

/** Tres pitidos cortos. */
export function playAlarm() {
  const c = getContext();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  const start = c.currentTime + 0.02;
  for (let i = 0; i < 3; i++) {
    const t = start + i * 0.32;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.26);
  }
}
