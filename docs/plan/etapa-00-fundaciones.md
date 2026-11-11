# Etapa 0 — Fundaciones

**Resultado:** una app vacía pero real, instalable en el celular desde una URL de producción, con DB local, tests, CI y deploy automático.
**Spec:** §4 (arquitectura), §8 (pantallas).

---

### T0.1 — Crear el proyecto Next.js
- **Depende de:** prerrequisitos 👤 (Node, pnpm, Git).
- **Objetivo:** repo base con Next.js, TypeScript estricto, Tailwind y scripts de calidad.
- **Archivos:** `package.json`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc`, `.editorconfig`, `.nvmrc`, `.gitignore`, `.env.example`, `app/layout.tsx`, `app/page.tsx`.
- **Pasos:**
  1. `pnpm create next-app@latest . --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*"` (en la raíz del repo, conservando `CLAUDE.md` y `docs/`).
  2. `tsconfig`: `strict: true`, `noUncheckedIndexedAccess: true`.
  3. Prettier + `prettier-plugin-tailwindcss`; integrarlo con ESLint (`eslint-config-prettier`).
  4. Scripts: `lint`, `typecheck` (`tsc --noEmit`), `format`, `check` (`lint && typecheck && test`). `test` puede ser `echo ok` hasta T0.6.
  5. `.nvmrc` con la versión LTS usada. `.env.example` vacío con un comentario de encabezado.
  6. `git init`, primer commit.
- **Aceptación:** `pnpm dev` muestra la página; `pnpm lint` y `pnpm typecheck` pasan.
- **Verificación:** `pnpm check`.
- **Fuera de alcance:** UI, Supabase, PWA.

### T0.2 — Design system base (shadcn/ui)
- **Depende de:** T0.1
- **Spec:** §8.1 (dirección visual "Fuego lento" y tabla de temas). Referencia visual: el canvas de diseño linkeado en §8.1.
- **Objetivo:** componentes y tokens visuales del estilo "Fuego lento", con los tres temas por momento del día.
- **Archivos:** `components.json`, `components/ui/*`, `app/globals.css`, `lib/utils.ts`, `lib/brand.ts`, `lib/theme/day-part.ts` + test, `components/theme/day-part-provider.tsx`.
- **Pasos:**
  1. `pnpm dlx shadcn@latest init`. Agregar: `button card input textarea label badge checkbox dialog sheet drawer tabs sonner skeleton avatar dropdown-menu separator scroll-area toggle-group`.
  2. Tokens CSS semánticos (`--background`, `--surface`, `--surface-2`, `--foreground`, `--muted`, `--accent`, `--accent-foreground`, `--hero`, `--border`, `--success`, `--danger-soft`; ver la tabla de tokens de [`docs/design/README.md`](../design/README.md)) definidos para tres temas con `[data-daypart="mediodia" | "tarde" | "noche"]` en `<html>`, con los valores de la tabla de §8.1. Mapearlos a los tokens de shadcn y de Tailwind. Radio: tarjetas `1.25rem`, botones principales en píldora (`9999px`).
  3. Tipografía vía `next/font/google`: **DM Serif Display** (títulos, clase `font-display`) e **Inter** (cuerpo).
  4. `lib/theme/day-part.ts`: `getDayPart(date, tz = "America/Argentina/Buenos_Aires")` → `mediodia` (< 16 h), `tarde` (16–20 h), `noche` (≥ 20 h o < 6 h). Tests en los bordes.
  5. `DayPartProvider`: calcula el tema en el servidor (evita parpadeo), lo recalcula cada minuto en el cliente, respeta una preferencia manual (`auto | mediodia | tarde | noche`) guardada en cookie, y actualiza `<meta name="theme-color">`. Hook `useDayPart()`. Prop para forzar un tema (el modo cocinar usa siempre `noche`).
  6. Componentes base del estilo: `Hero` (bloque de color con slot de imagen, título serif y un botón principal), `PillButton`, `SectionTitle`.
  7. `lib/brand.ts`: `export const BRAND = { name: "Recetario", tagline: "Las recetas de tu casa" }`. Usarlo en `<title>` y metadata.
  8. Página `/dev/ui` (solo en desarrollo) con todos los componentes y un selector para ver los tres temas lado a lado.
- **Aceptación:** `/dev/ui` se ve bien en los tres temas a 375 px; todo texto pasa contraste AA; cambiar la hora del sistema cambia el tema sin recargar.
- **Verificación:** `pnpm check` + revisión visual.
- **Fuera de alcance:** layout de la app.

### T0.3 — App shell mobile
- **Depende de:** T0.2
- **Objetivo:** estructura de navegación de la app con páginas vacías.
- **Spec:** §8.
- **Archivos:** `app/(app)/layout.tsx`, `components/shell/bottom-nav.tsx`, `components/shell/top-bar.tsx`, `app/(app)/g/[groupId]/{hoy,recetas,plan,compras}/page.tsx`, `app/(app)/perfil/page.tsx`.
- **Pasos:**
  1. Barra inferior fija con 5 tabs: Hoy, Recetas, Plan, Compras, Perfil (íconos `lucide-react`), estado activo según la ruta. Respetar `env(safe-area-inset-bottom)`.
  2. Barra superior con título de sección y un placeholder del selector de grupo (se implementa en T1.4).
  3. Páginas con estado vacío ilustrado + texto ("Todavía no hay recetas").
  4. Mientras no haya auth, `app/page.tsx` redirige a `/g/demo/hoy`.
  5. Contenedor de ancho máximo `max-w-md` centrado en desktop.
- **Aceptación:** se navega entre tabs en el celular sin recargar; la barra no tapa contenido.
- **Verificación:** `pnpm check` + prueba a 375 px.
- **Fuera de alcance:** datos reales.

### T0.4 — PWA instalable
- **Depende de:** T0.3
- **Objetivo:** que la app se instale en la pantalla de inicio y abra en modo standalone.
- **Archivos:** `app/manifest.ts`, `public/icons/*`, `app/sw.ts`, `next.config.ts`, `app/offline/page.tsx`.
- **Pasos:**
  1. `app/manifest.ts`: `name`/`short_name` desde `BRAND`, `display: "standalone"`, `start_url: "/"`, colores del tema, íconos 192/512 + `maskable`.
  2. Íconos placeholder (SVG simple generado → PNGs) en `public/icons/`.
  3. Service worker con **Serwist** (`@serwist/next`): precache del shell + fallback offline en `/offline`.
  4. Meta tags iOS: `apple-touch-icon`, `apple-mobile-web-app-capable`, `theme-color`.
- **Aceptación:** Chrome muestra "Instalar app"; en iOS "Agregar a inicio" abre sin la barra de Safari.
- **Verificación:** Lighthouse → PWA instalable; prueba en el celular después de T0.8.
- **Fuera de alcance:** push y cache de datos (Etapa 10).

### T0.5 — Supabase local y clientes
- **Depende de:** T0.1 · 👤 Docker Desktop corriendo.
- **Objetivo:** DB local funcionando y clientes tipados para server y browser.
- **Archivos:** `supabase/config.toml`, `lib/supabase/{server,client,admin,middleware}.ts`, `middleware.ts`, `lib/supabase/database.types.ts`, `.env.example`.
- **Pasos:**
  1. `pnpm add @supabase/supabase-js @supabase/ssr` y `pnpm add -D supabase`.
  2. `pnpm supabase init`. Scripts: `db:start`, `db:stop`, `db:reset`, `db:test`, `db:types` (`supabase gen types typescript --local > lib/supabase/database.types.ts`).
  3. `server.ts` (`createServerClient` con cookies de `next/headers`), `client.ts` (`createBrowserClient`), `admin.ts` (service role, con `import "server-only"`).
  4. `middleware.ts` que refresca la sesión (patrón oficial de `@supabase/ssr`).
  5. `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`.
  6. Habilitar extensiones en una primera migración: `pg_trgm`, `unaccent`.
- **Aceptación:** `pnpm db:start` levanta; `pnpm db:reset` aplica la migración; `pnpm db:types` genera tipos.
- **Verificación:** los tres comandos + `pnpm check`.
- **Fuera de alcance:** tablas de negocio.

### T0.6 — Infraestructura de tests
- **Depende de:** T0.5
- **Archivos:** `vitest.config.ts`, `lib/domain/example.test.ts`, `playwright.config.ts`, `tests/e2e/smoke.spec.ts`, `supabase/tests/00_smoke.test.sql`.
- **Pasos:**
  1. Vitest (entorno `node` por defecto; `jsdom` para archivos `*.dom.test.tsx`). `test` corre Vitest.
  2. Playwright: proyecto único `mobile` (390×844, `isMobile`, `hasTouch`), `webServer: pnpm dev`. Script `test:e2e`.
  3. Smoke e2e: abre `/`, ve la barra inferior y navega a Recetas.
  4. pgTAP: test trivial que corre con `pnpm db:test`.
- **Aceptación:** `pnpm test`, `pnpm test:e2e` y `pnpm db:test` pasan.
- **Fuera de alcance:** tests de negocio.

### T0.7 — CI en GitHub Actions
- **Depende de:** T0.6 · 👤 crear el repo en GitHub (privado) y hacer push.
- **Archivos:** `.github/workflows/ci.yml`.
- **Pasos:**
  1. Job `check`: checkout, pnpm con cache, `pnpm install --frozen-lockfile`, `lint`, `typecheck`, `test`, `build` (con env de ejemplo).
  2. Job `db` (paralelo): `supabase/setup-cli`, `supabase start`, `supabase db reset`, `supabase test db`.
  3. Job `e2e` (depende de `db`, puede quedar en `workflow_dispatch` y en `main` hasta que sea estable).
- **Aceptación:** un PR muestra los checks en verde.
- **Fuera de alcance:** deploy (lo hace Vercel).

### T0.8 — Producción: Supabase + Vercel + monitoreo
- **Depende de:** T0.7
- **Pasos 👤:**
  1. Crear proyecto Supabase `recetario-prod` en **South America (São Paulo)**. Copiar URL, anon key y service role key.
  2. Importar el repo en Vercel. Variables de entorno de producción y preview. `NEXT_PUBLIC_SITE_URL` = dominio de Vercel.
  3. (Opcional) Crear proyectos de Sentry y PostHog y pasar las keys.
- **Pasos del agente:**
  1. Documentar en `docs/deploy.md`: cómo vincular (`supabase link --project-ref …`) y aplicar migraciones a prod (`supabase db push`), qué variables van en Vercel.
  2. Workflow `.github/workflows/migrate.yml`: al hacer push a `main` con cambios en `supabase/migrations`, corre `supabase db push` (secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` 👤).
  3. Sentry (`@sentry/nextjs`) y PostHog (`posthog-js`), activos **solo si** sus env vars existen.
  4. Página `/api/health` que devuelve `{ ok: true, db: <ping> }`.
- **Aceptación:** la URL de producción abre en el celular, se instala como app y `/api/health` responde `db: true`.
- **Verificación:** prueba manual en iOS y Android si es posible.

---

## Cierre de la Etapa 0
- [ ] App en producción, instalable.
- [ ] CI en verde.
- [ ] `docs/deploy.md` escrito.

## Notas de ejecución
<!-- El agente anota acá decisiones tomadas que no estaban en el spec. -->
