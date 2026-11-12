import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWakeLock } from "./use-wake-lock";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Probe({ onUnsupported }: { onUnsupported?: () => void }) {
  useWakeLock({ onUnsupported });
  return null;
}

function makeSentinel() {
  const s = { released: false, release: vi.fn(async () => void (s.released = true)) };
  return s;
}

let root: Root;
let container: HTMLElement;

beforeEach(() => {
  container = document.createElement("div");
  root = createRoot(container);
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});

afterEach(() => {
  act(() => root.unmount());
  Reflect.deleteProperty(navigator, "wakeLock");
});

describe("useWakeLock", () => {
  it("pide el wake lock al montar y lo suelta al desmontar", async () => {
    const sentinel = makeSentinel();
    const request = vi.fn(async () => sentinel);
    Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });

    await act(async () => root.render(createElement(Probe)));
    expect(request).toHaveBeenCalledWith("screen");

    await act(async () => root.unmount());
    expect(sentinel.release).toHaveBeenCalled();
    root = createRoot(container); // para el afterEach
  });

  it("lo vuelve a pedir al volver a la pantalla si el navegador lo soltó", async () => {
    const first = makeSentinel();
    const second = makeSentinel();
    const request = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });

    await act(async () => root.render(createElement(Probe)));
    first.released = true; // el navegador lo soltó al cambiar de pestaña
    await act(async () => void document.dispatchEvent(new Event("visibilitychange")));

    expect(request).toHaveBeenCalledTimes(2);
  });

  it("avisa una vez si no hay soporte", async () => {
    const onUnsupported = vi.fn();
    await act(async () => root.render(createElement(Probe, { onUnsupported })));
    expect(onUnsupported).toHaveBeenCalledTimes(1);
  });
});
