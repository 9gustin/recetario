/** Notificaciones locales del navegador (solo cliente). */

const ASKED_KEY = "recetario-notif-asked";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  return notificationsSupported() ? Notification.permission : "unsupported";
}

/** ¿Vale la pena explicar y pedir permiso? (todavía no se decidió y no se preguntó antes) */
export function shouldAskNotificationPermission(): boolean {
  if (notificationPermission() !== "default") return false;
  try {
    return localStorage.getItem(ASKED_KEY) !== "1";
  } catch {
    return false;
  }
}

export function markNotificationAsked() {
  try {
    localStorage.setItem(ASKED_KEY, "1");
  } catch {
    // sin localStorage: se vuelve a preguntar la próxima vez, no pasa nada.
  }
}

export async function requestNotificationPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  markNotificationAsked();
  if (!notificationsSupported()) return "unsupported";
  return Notification.requestPermission();
}

/** Muestra una notificación (por el service worker si está, que funciona mejor en el celular). */
export async function showLocalNotification(title: string, body: string, tag: string) {
  if (notificationPermission() !== "granted") return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, { body, tag, icon: "/icons/icon-192.png" });
      return;
    }
  } catch {
    // cae al constructor
  }
  new Notification(title, { body, tag, icon: "/icons/icon-192.png" });
}
