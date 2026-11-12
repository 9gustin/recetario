/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkFirst, Serwist, StaleWhileRevalidate } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Páginas que se usan en el súper o cocinando: la última versión vista queda disponible sin red.
    {
      matcher: ({ request, url }) =>
        request.destination === "document" &&
        /^\/g\/[^/]+\/(recetas|compras|plan|hoy)/.test(url.pathname),
      handler: new NetworkFirst({
        cacheName: "app-pages",
        networkTimeoutSeconds: 4,
        plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 7 * 24 * 60 * 60 })],
      }),
    },
    // Datos de Next (RSC) de esas mismas pantallas.
    {
      matcher: ({ url, request }) =>
        request.headers.get("RSC") === "1" &&
        /^\/g\/[^/]+\/(recetas|compras|plan)/.test(url.pathname),
      handler: new StaleWhileRevalidate({
        cacheName: "app-rsc",
        plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 24 * 60 * 60 })],
      }),
    },
    // Fotos de recetas: primero la copia local, con tope de cantidad.
    {
      matcher: ({ request }) => request.destination === "image",
      handler: new CacheFirst({
        cacheName: "app-images",
        plugins: [new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();

// Notificaciones push: si la app está abierta y a la vista, no se duplica el aviso.
self.addEventListener("push", (event) => {
  const data = (() => {
    try {
      return event.data?.json() as { title: string; body?: string; url?: string; tag?: string };
    } catch {
      return undefined;
    }
  })();
  if (!data?.title) return;
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (clients.some((c) => c.visibilityState === "visible")) return;
      await self.registration.showNotification(data.title, {
        body: data.body,
        tag: data.tag,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        data: { url: data.url ?? "/" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? "/";
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = clients.find((c) => "focus" in c);
      if (open) {
        await open.navigate(url).catch(() => undefined);
        await open.focus();
      } else {
        await self.clients.openWindow(url);
      }
    })(),
  );
});
