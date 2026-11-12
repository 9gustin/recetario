"use client";

/** Convierte la clave VAPID pública (base64url) al formato que pide el navegador. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type PushSupport = "unsupported" | "ios-needs-install" | "ok";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone;
  if (ios && !standalone) return "ios-needs-install";
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
    ? "ok"
    : "unsupported";
}

/** Pide permiso y suscribe este dispositivo. Devuelve un mensaje de error en español si algo falla. */
export async function enablePush(): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return { ok: false, error: "Las notificaciones no están configuradas todavía." };
  if (pushSupport() !== "ok")
    return { ok: false, error: "Este dispositivo no permite notificaciones desde el navegador." };
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    return {
      ok: false,
      error: "No diste permiso. Podés activarlo desde los ajustes del navegador.",
    };
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    }));
  const json = sub.toJSON();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
  return res.ok ? { ok: true } : { ok: false, error: "No pudimos guardar la suscripción." };
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });
  await sub.unsubscribe();
}

export async function isSubscribed(): Promise<boolean> {
  if (pushSupport() !== "ok") return false;
  const reg = await navigator.serviceWorker.ready;
  return (await reg.pushManager.getSubscription()) !== null;
}
