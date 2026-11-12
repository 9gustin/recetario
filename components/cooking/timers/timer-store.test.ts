import { beforeEach, describe, expect, it } from "vitest";
import {
  addMinute,
  createTimer,
  finishTimer,
  isFinished,
  pauseTimer,
  remainingMs,
  resumeTimer,
  timerId,
  useTimerStore,
  type TimerInput,
} from "./timer-store";

const input: TimerInput = {
  recipeId: "r1",
  stepIndex: 2,
  label: "Paso 3",
  durationSeconds: 300,
  passive: true,
};
const T0 = 1_000_000;

describe("timers basados en timestamps", () => {
  it("calcula el tiempo restante desde endsAt", () => {
    const t = createTimer(input, T0);
    expect(t.id).toBe(timerId("r1", 2));
    expect(remainingMs(t, T0)).toBe(300_000);
    expect(remainingMs(t, T0 + 120_000)).toBe(180_000);
    expect(remainingMs(t, T0 + 999_000)).toBe(0);
  });

  it("con la pantalla bloqueada 1 minuto, al volver el restante es correcto (dos timers)", () => {
    const a = createTimer(input, T0);
    const b = createTimer({ ...input, stepIndex: 4, durationSeconds: 600 }, T0 + 10_000);
    const back = T0 + 60_000; // no hubo ticks durante ese minuto
    expect(remainingMs(a, back)).toBe(240_000);
    expect(remainingMs(b, back)).toBe(550_000);
  });

  it("pausar congela el tiempo y reanudar lo retoma", () => {
    const paused = pauseTimer(createTimer(input, T0), T0 + 100_000);
    expect(paused.status).toBe("paused");
    expect(remainingMs(paused, T0 + 500_000)).toBe(200_000);
    const resumed = resumeTimer(paused, T0 + 500_000);
    expect(remainingMs(resumed, T0 + 530_000)).toBe(170_000);
  });

  it("+1 min suma al timer en marcha, pausado o terminado", () => {
    const t = createTimer(input, T0);
    expect(remainingMs(addMinute(t, T0), T0)).toBe(360_000);
    expect(remainingMs(addMinute(pauseTimer(t, T0), T0), T0)).toBe(360_000);
    const again = addMinute(finishTimer(t), T0 + 400_000);
    expect(again.status).toBe("running");
    expect(remainingMs(again, T0 + 400_000)).toBe(60_000);
  });

  it("detecta cuándo termina", () => {
    const t = createTimer(input, T0);
    expect(isFinished(t, T0 + 299_999)).toBe(false);
    expect(isFinished(t, T0 + 300_000)).toBe(true);
    expect(isFinished(finishTimer(t), T0 + 400_000)).toBe(false);
  });
});

describe("useTimerStore", () => {
  beforeEach(() => useTimerStore.setState({ timers: {} }));

  it("maneja varios timers a la vez y devuelve los que terminaron una sola vez", () => {
    const s = useTimerStore.getState();
    s.start(input, T0);
    s.start({ ...input, stepIndex: 4, durationSeconds: 900 }, T0);
    expect(Object.keys(useTimerStore.getState().timers)).toHaveLength(2);

    const done = useTimerStore.getState().collectFinished(T0 + 301_000);
    expect(done.map((t) => t.stepIndex)).toEqual([2]);
    expect(useTimerStore.getState().timers[timerId("r1", 2)]?.status).toBe("done");
    expect(useTimerStore.getState().collectFinished(T0 + 302_000)).toEqual([]);
  });

  it("restart vuelve a la duración original", () => {
    const s = useTimerStore.getState();
    s.start(input, T0);
    s.restart(timerId("r1", 2), T0 + 100_000);
    const t = useTimerStore.getState().timers[timerId("r1", 2)]!;
    expect(remainingMs(t, T0 + 100_000)).toBe(300_000);
  });
});
