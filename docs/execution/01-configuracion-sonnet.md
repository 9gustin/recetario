# 01 · Configuración — Claude Sonnet

Sonnet arma la base del proyecto (Etapa 0 completa) y configura los servicios externos que pide cada etapa. Se usa en **Claude Code**, abierto en `~/projects/recetario` (WSL), con el modelo **Sonnet**.

- Línea de tiempo y reparto: [README.md](README.md)
- Reglas del repo: [`CLAUDE.md`](../../CLAUDE.md)

---

## A. Antes de empezar 👤

Tené a mano (o creá cuando el agente te lo pida):

| Qué | Dónde | Para |
|---|---|---|
| Node.js LTS + pnpm (`corepack enable`) **en WSL** | Terminal WSL | Todo |
| **Docker Desktop** con integración WSL activada (Settings → Resources → WSL integration → Ubuntu) | Windows | Supabase local |
| Cuenta de Supabase | supabase.com | Base de datos en producción |
| Cuenta de Vercel conectada a GitHub | vercel.com | Hosting |
| Proyecto en Google Cloud (OAuth) | console.cloud.google.com | Login con Google (Etapa 1) |
| API key de Anthropic | console.anthropic.com | IA (Etapa 5) |
| API key de OpenAI o Deepgram | sus consolas | Voz (Etapa 5) |
| Cuenta de Inngest | inngest.com | Jobs (Etapa 9) |
| Sentry y PostHog (opcionales) | sus sitios | Errores y analytics |

**Claves:** nunca se pegan en el chat ni en archivos commiteados. El agente te dice *dónde* pegarlas (`.env.local`, dashboard de Vercel, secrets de GitHub) y vos lo hacés.

---

## B. Fase 0 — Etapa 0 completa

Se hace en **tres sesiones** (una por bloque) para que cada una quede corta y revisable. Para cada sesión, abrí Claude Code nuevo con Sonnet y pegá el prompt.

### Sesión B1 — Proyecto, diseño y estructura (T0.1–T0.4)

```text
Sos el responsable de la configuración inicial del proyecto. Trabajás en ~/projects/recetario (WSL).

Leé primero, en este orden:
1. CLAUDE.md
2. docs/execution/README.md y docs/execution/01-configuracion-sonnet.md
3. docs/plan/README.md y docs/plan/etapa-00-fundaciones.md
4. docs/SPEC.md §4 (arquitectura) y §8 (pantallas, en especial §8.1 dirección visual)
5. docs/design/README.md y, como referencia visual, docs/design/pantallas/Noche.html, Mediodia.html y Tarde.html

Ejecutá las tareas T0.1, T0.2, T0.3 y T0.4, en orden, siguiendo exactamente sus pasos y criterios de aceptación.

Reglas:
- Trabajá en la rama main (es la etapa de fundaciones). Un commit por tarea: "T0.1: <resumen>".
- Antes de cada tarea, decime en 3 líneas qué vas a hacer. Después de cada una, corré su verificación y `pnpm check` (cuando exista).
- T0.2 es la base visual de toda la app: los tokens de los tres temas tienen que coincidir con la tabla de SPEC §8.1 y con la tabla de tokens de docs/design/README.md. Agregá también --success y --danger-soft.
- T0.3: la barra inferior tiene que coincidir con la de docs/design/pantallas/Noche.html (alturas, íconos lucide equivalentes, estado activo con --accent).
- Creá también AGENTS.md en la raíz con una sola línea: "Leé y seguí CLAUDE.md antes de hacer cualquier cosa." (lo usan otros agentes).
- Si una decisión no está en el plan, elegí lo más simple y anotala en "Notas de ejecución" de etapa-00-fundaciones.md.
- Marcá cada tarea en el archivo de la etapa y en el tablero de docs/plan/README.md.
- No avances a T0.5.

Al final, decime: qué quedó hecho, cómo lo veo (comandos) y qué decisiones tomaste.
```

### Sesión B2 — Base de datos local y pruebas (T0.5–T0.6)

```text
Seguís con la configuración inicial del proyecto en ~/projects/recetario (WSL).

Leé CLAUDE.md, docs/execution/01-configuracion-sonnet.md y docs/plan/etapa-00-fundaciones.md (T0.5 y T0.6). Revisá `git log` para ver lo que ya está hecho.

Ejecutá T0.5 y T0.6, en orden, en la rama main, un commit por tarea.

Reglas:
- Antes de T0.5 verificá que Docker responda dentro de WSL (`docker info`). Si no responde, pará y pedime que active la integración WSL en Docker Desktop.
- Supabase local con `pnpm supabase` (dependencia de desarrollo). Copiá las claves locales que imprime `supabase status` a .env.local (no se commitea) y documentá los nombres de las variables en .env.example.
- Playwright: instalá los navegadores con `pnpm exec playwright install --with-deps chromium`. Si `--with-deps` pide sudo, pedime que corra ese comando yo.
- Al terminar, `pnpm check`, `pnpm test:e2e` y `pnpm db:test` tienen que pasar.
- Marcá las tareas en el plan y en el tablero.

Al final, listame los comandos que quedaron disponibles y cómo levanto todo desde cero.
```

### Sesión B3 — CI y producción (T0.7–T0.8)

```text
Seguís con la configuración inicial del proyecto en ~/projects/recetario (WSL). Revisá `git log`.

Leé CLAUDE.md, docs/execution/01-configuracion-sonnet.md y docs/plan/etapa-00-fundaciones.md (T0.7 y T0.8).

Ejecutá T0.7 y T0.8. El repo ya existe en GitHub (9gustin/recetario, privado) y `gh` está logueado.

Reglas:
- Los pasos 👤 los hago yo: decime exactamente qué hacer, dónde hacer clic y qué valor va en cada campo; esperá a que te confirme. Nunca me pidas que pegue claves en el chat.
- Secrets de GitHub: decime los nombres; los cargo yo con `gh secret set NOMBRE` (pide el valor de forma interactiva) o desde la web.
- Variables de Vercel: dame la lista (nombre → de dónde sale el valor) para cargarlas en el dashboard, en Production y Preview.
- Supabase prod: región São Paulo (sa-east-1). Vinculalo con `supabase link` (te paso el project ref) y aplicá las migraciones con `supabase db push`.
- Escribí docs/deploy.md tal como dice T0.8.
- Al final verificá: CI en verde en un PR de prueba, la URL de producción abre, /api/health responde db: true.
- Marcá las tareas en el plan y el tablero.

Al terminar: hacé la revisión de cierre de Etapa 0 siguiendo docs/execution/03-revision-sonnet.md (sección "Revisión de etapa") y dejá el informe en docs/reviews/etapa-00.md.
```

---

## C. Configuración puntual por etapa

Se hace **antes** de que DeepSeek empiece la etapa. Prompt base (cambiá el número de etapa):

```text
Sos el responsable de configuración del proyecto en ~/projects/recetario (WSL).

Leé CLAUDE.md, docs/execution/README.md, docs/execution/01-configuracion-sonnet.md (sección C) y el archivo de la Etapa <N> en docs/plan/.

Hacé solo la configuración puntual de la Etapa <N> que está en la tabla de la sección C de 01-configuracion-sonnet.md. No escribas código de la etapa: eso lo hace otro agente.

Reglas:
- Los pasos en consolas web los hago yo: guiame paso a paso y esperá mi confirmación.
- Nunca me pidas claves en el chat. Decime en qué archivo o panel van (.env.local, Vercel, secrets de GitHub, config.toml de Supabase).
- Lo que se pueda dejar en el repo (config.toml, .env.example, docs/deploy.md) dejalo commiteado en main con el mensaje "config(etapa-<N>): <resumen>".
- Creá la rama etapa-<N> desde main y subila (git push -u origin etapa-<N>), para que el otro agente trabaje ahí.
- Al final, verificá que la configuración funciona con la prueba de la tabla y decime qué quedó listo.
```

| Etapa | Configuración | Prueba de que funciona |
|---|---|---|
| 1 | **Google OAuth**: crear el OAuth Client (web) en Google Cloud con orígenes `http://localhost:3000` y el dominio de Vercel, y redirects `http://127.0.0.1:54321/auth/v1/callback` (local) y `https://<ref>.supabase.co/auth/v1/callback` (prod). Habilitar Google en `supabase/config.toml` (local, leyendo `env(...)`) y en el dashboard de Supabase (prod). Site URL y Redirect URLs de Supabase Auth (local y prod). | `supabase start` sin errores; en el dashboard, el provider Google aparece habilitado. |
| 5 | **Anthropic**: `ANTHROPIC_API_KEY` en `.env.local` y Vercel. **Transcripción**: `TRANSCRIPTION_PROVIDER` y la key del proveedor. Hacer la **prueba de calidad** del paso 6 de T5.2 con un script temporal (3 audios en español rioplatense, ambos proveedores) y anotar la elección en Notas de ejecución de etapa-05. | Un `curl` mínimo a cada API responde 200 (sin imprimir la key). |
| 2, 3, 4, 5b, 6, 7, 8, 8b | No hace falta configuración. Solo crear la rama `etapa-XX`. | — |
| 9 | **Inngest**: cuenta, integración con Vercel, `INNGEST_EVENT_KEY` e `INNGEST_SIGNING_KEY` en Vercel; para local, documentar `pnpm dlx inngest-cli dev`. | El dev server de Inngest abre en `http://localhost:8288`. |
| 10 | **Web Push**: generar claves VAPID (`pnpm dlx web-push generate-vapid-keys`), cargar `NEXT_PUBLIC_VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` en `.env.local` y Vercel, `VAPID_SUBJECT` = `mailto:` del dueño. | Las variables existen en Vercel (Production y Preview). |
