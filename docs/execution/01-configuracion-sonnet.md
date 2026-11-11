# 01 · Configuración — instrucciones para Claude Sonnet

> Este archivo es tu guía completa. Ejecutalo de principio a fin. Si se corta la sesión, al volver leé `docs/execution/progreso.md` y retomá desde el primer paso sin tildar.

## Objetivo final

Dejar el proyecto **listo para que otro agente (DeepSeek, un modelo más básico) escriba todo el código de las Etapas 1 a 10 sin tener que configurar nada**. Al terminar tiene que ser verdad que:

1. La **Etapa 0** del plan está completa (T0.1 a T0.8): proyecto Next.js, sistema de diseño con los tres temas, estructura de la app, PWA, Supabase local, pruebas, CI y producción en Vercel + Supabase.
2. **Todos los servicios externos** que va a necesitar la app están configurados, local y en producción: Google OAuth, Anthropic, transcripción de voz (con el proveedor ya elegido por una prueba de calidad), Inngest y Web Push.
3. Existe la rama **`dev`** (donde va a trabajar DeepSeek) y el archivo **`docs/execution/progreso.md`** con todo lo de configuración tildado.
4. `pnpm check`, `pnpm test:e2e` y `pnpm db:test` pasan, el CI está en verde y la URL de producción abre y responde en `/api/health`.

Lo que **no** hacés: código de las Etapas 1 a 10.

---

## Reglas

1. **Trabajás en `~/projects/recetario` (WSL)**, en la rama `main`. Un commit por tarea o bloque: `T0.x: <resumen>` o `config: <resumen>`. `git push` después de cada commit.
2. **Leé antes de empezar:** `CLAUDE.md`, `docs/SPEC.md` (§4 arquitectura, §5.3 seguridad, §8 pantallas y §8.1 dirección visual), `docs/plan/README.md`, `docs/plan/etapa-00-fundaciones.md`, `docs/design/README.md` y las pantallas `docs/design/pantallas/Noche.html`, `Mediodia.html` y `Tarde.html`.
3. **Pasos 👤 los hace la persona** (consolas web, cuentas, pegar claves). Guiala paso a paso: qué página abrir, dónde hacer clic, qué valor va en cada campo. Esperá su confirmación antes de seguir.
4. **Claves:** nunca se piden ni se escriben en el chat, nunca se imprimen (`echo`, `cat .env.local`) y nunca van a archivos commiteados. Decile a la persona en qué archivo o panel van: `.env.local` (local), Vercel → Settings → Environment Variables (Production y Preview), GitHub → `gh secret set NOMBRE` (pide el valor de forma interactiva). Documentá **los nombres** en `.env.example`.
5. **Progreso:** después de cada paso, tildalo en `docs/execution/progreso.md` (sección "Configuración") y commitealo junto con el paso.
6. **Decisiones** que no estén en el plan: elegí la opción más simple y anotala en "Notas de ejecución" de `docs/plan/etapa-00-fundaciones.md`.
7. Si algo necesita `sudo`, pedile a la persona que corra ese comando.

---

## Paso 1 — Verificar el entorno

1. En WSL: `node -v` (LTS), `corepack enable && pnpm -v`, `git -v`, `gh auth status`.
2. `docker info` dentro de WSL. Si no responde: pedile a la persona que abra Docker Desktop → Settings → Resources → WSL integration → activar Ubuntu → Apply & restart, y que te avise.
3. Confirmá que el repo es `9gustin/recetario` (`git remote -v`) y que `main` está al día.

## Paso 2 — Proyecto base (T0.1)

Ejecutá **T0.1** de `docs/plan/etapa-00-fundaciones.md` tal como está escrita. Además, creá `AGENTS.md` en la raíz con una sola línea: `Leé y seguí CLAUDE.md antes de hacer cualquier cosa.`

## Paso 3 — Sistema de diseño (T0.2)

Ejecutá **T0.2**. Es la base visual de toda la app; DeepSeek va a usar estos componentes y tokens en cada pantalla.

- Los tokens de los tres temas (`mediodia`, `tarde`, `noche`) tienen que coincidir **exactamente** con la tabla de SPEC §8.1 y con la tabla de tokens de `docs/design/README.md` (incluí `--success` y `--danger-soft`).
- Mapeá los tokens a clases de Tailwind con estos nombres, que son los que usan las instrucciones de DeepSeek: `bg-background`, `bg-surface`, `bg-surface-2`, `text-foreground`, `text-muted`, `bg-accent`, `text-accent`, `text-accent-foreground`, `bg-hero`, `border-border`, `text-success`, `text-danger-soft`, y `font-display` para DM Serif Display.
- Componentes base: `Hero`, `PillButton`, `SectionTitle` (y los de shadcn listados en la tarea), tomando medidas de `Noche.html` y `Tarde.html`.

## Paso 4 — Estructura de la app (T0.3)

Ejecutá **T0.3**. La barra inferior tiene que coincidir con la de `docs/design/pantallas/Noche.html`: 76 px de alto, 5 tabs (Hoy, Recetas, Plan, Compras, Perfil) con íconos de lucide (sun, book, calendar, shopping-bag, user), texto de 11 px, activo con `text-accent`. Componente `BottomNav` reutilizable.

## Paso 5 — PWA (T0.4)

Ejecutá **T0.4**.

## Paso 6 — Supabase local (T0.5)

Ejecutá **T0.5**. Copiá las claves locales que imprime `pnpm supabase status` a `.env.local` (esas son claves locales de desarrollo; igual no las muestres en el chat).

## Paso 7 — Pruebas (T0.6)

Ejecutá **T0.6**. Para los navegadores de Playwright: `pnpm exec playwright install chromium`; si hacen falta dependencias del sistema, pedile a la persona que corra `sudo pnpm exec playwright install-deps chromium`.

## Paso 8 — CI (T0.7)

Ejecutá **T0.7**.

## Paso 9 — Producción (T0.8) 👤

Ejecutá **T0.8**, guiando a la persona:

1. Supabase: crear el proyecto `recetario-prod` en **South America (São Paulo)**. Pedile el *project ref* (no es secreto) y que guarde la contraseña de la base en su gestor de contraseñas.
2. Vincular: `pnpm supabase link --project-ref <ref>` (la CLI pide la contraseña de forma interactiva: que la escriba la persona) y `pnpm supabase db push`.
3. Vercel: importar el repo, framework Next.js. Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL` (dominio de Vercel), en Production y Preview.
4. GitHub secrets para el workflow de migraciones: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`.
5. Sentry y PostHog: preguntá si los quiere ahora. Si sí, guiá la creación y cargá sus variables; si no, quedan desactivados (el código ya los ignora sin variables).
6. Escribí `docs/deploy.md`.
7. Verificá: deploy en verde, la URL abre en el celular, `/api/health` responde `db: true`.

## Paso 10 — Login con Google 👤

Lo necesita la Etapa 1.

1. Google Cloud → APIs & Services → OAuth consent screen (External, nombre de la app, email de soporte de la persona) → Credentials → Create OAuth client ID → Web application.
   - Authorized JavaScript origins: `http://localhost:3000` y el dominio de Vercel.
   - Authorized redirect URIs: `http://127.0.0.1:54321/auth/v1/callback` y `https://<ref>.supabase.co/auth/v1/callback`.
2. Local: en `supabase/config.toml`, `[auth.external.google]` con `enabled = true`, `client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"`, `secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"` y `redirect_uri` local. La persona pega los valores en `.env.local`. `site_url` y `additional_redirect_urls` para `http://localhost:3000/auth/callback`.
3. Prod: la persona habilita Google en Supabase → Authentication → Providers con el mismo client. Site URL = dominio de Vercel; Redirect URLs = `https://<dominio>/auth/callback`.
4. Magic link: en local llega a Mailpit (`http://localhost:54324`). En prod alcanza el SMTP de Supabase para empezar; anotá en `docs/deploy.md` que más adelante conviene un SMTP propio.
5. Verificá: `pnpm db:stop && pnpm db:start` sin errores y el provider habilitado en prod.

## Paso 11 — IA: Anthropic 👤

1. La persona crea una API key en console.anthropic.com y la carga como `ANTHROPIC_API_KEY` en `.env.local` y en Vercel.
2. Verificá con un `curl` a `https://api.anthropic.com/v1/messages` (modelo `claude-haiku-5-5`, `max_tokens: 20`) leyendo la key desde `.env.local` con `source` en un subshell, **sin imprimirla**. Tiene que responder 200.
3. Agregá `ANTHROPIC_API_KEY` a `.env.example` (sin valor).

## Paso 12 — Voz: elegir proveedor de transcripción 👤

1. La persona crea keys de **OpenAI** y de **Deepgram** (si solo quiere una, saltá la comparación y usá esa) y las pega en `.env.local` (`OPENAI_API_KEY`, `DEEPGRAM_API_KEY`).
2. Pedile que grabe 3 audios cortos en el celular (20 a 40 s, español rioplatense, con palabras de cocina: "zapallitos, morrón, cebolla de verdeo, milanesa, una cucharada de aceite…") y que los deje en una carpeta **fuera del repo** (ej. `~/audios-prueba`).
3. Con un script temporal en `/tmp` (no en el repo), transcribí los 3 audios con ambos proveedores (OpenAI: `gpt-4o-transcribe`, `language=es`; Deepgram: modelo `nova-3`, `language=es-419`). Mostrale a la persona las transcripciones lado a lado y elegí con ella.
4. Anotá la elección y el motivo en "Notas de ejecución" de `docs/plan/etapa-05-ia-importar.md` (eso hace que el paso 6 de T5.2 quede hecho).
5. `TRANSCRIPTION_PROVIDER=openai|deepgram` y la key elegida en `.env.local` y Vercel. Nombres en `.env.example`.

## Paso 13 — Jobs: Inngest 👤

1. La persona crea la cuenta en inngest.com e instala la integración de Vercel para este proyecto (eso carga `INNGEST_EVENT_KEY` e `INNGEST_SIGNING_KEY` en Vercel). Si no usa la integración, que las cargue a mano.
2. Para local, documentá en `docs/deploy.md`: `pnpm dlx inngest-cli@latest dev` (UI en `http://localhost:8288`).
3. Nombres en `.env.example`.

## Paso 14 — Notificaciones: Web Push

1. Generá las claves: `pnpm dlx web-push generate-vapid-keys` (la salida tiene la clave privada: no la muestres entera en tu respuesta; pedile a la persona que la copie de la terminal).
2. La persona carga `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` (`mailto:` con su email) en `.env.local` y Vercel.
3. Nombres en `.env.example`.

## Paso 15 — Dejar todo listo para DeepSeek

1. Revisá que `.env.example` tenga **todas** las variables, agrupadas y comentadas.
2. Agregá a `docs/deploy.md` la sección "Variables de entorno" con nombre → para qué → dónde se carga.
3. Corré `pnpm check`, `pnpm test:e2e`, `pnpm db:test`, `pnpm build`. Todo en verde.
4. Creá la rama de trabajo: `git checkout -b dev && git push -u origin dev`, y volvé a `main`.
5. En `docs/execution/progreso.md`: tildá toda la configuración, y en "Código" dejá como próxima tarea **T1.1**.
6. Marcá T0.1 a T0.8 en el tablero de `docs/plan/README.md` y completá "Cierre de la Etapa 0" en su archivo.
7. Commit `config: ready for development` y push.

## Respuesta final

En español, corta:
- Qué quedó configurado (lista) y qué quedó pendiente o desactivado (ej. Sentry).
- Resultado de las pruebas y del CI.
- URL de producción.
- "Ya podés pasar al paso 2 (código con DeepSeek)."
