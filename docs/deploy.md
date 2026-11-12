# Deploy y operación

Producción: **Vercel** (app) + **Supabase** `recetario-prod` (región São Paulo). Las migraciones se aplican a producción con GitHub Actions.

- **Project ref de producción:** `fsqielfvruyhzietrgxn` (URL: `https://fsqielfvruyhzietrgxn.supabase.co`). No es secreto.
- **Claves:** Supabase ahora entrega *publishable key* (`sb_publishable_…`, pública) y *secret key* (`sb_secret_…`, solo servidor). La app las lee como `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` respectivamente (los nombres no cambian).

- **URL de producción:** https://recetario-lime-kappa.vercel.app

## Cómo se despliega

- **App:** cada push a `main` despliega a producción en Vercel; cada PR/rama genera un preview.
- **Base de datos:** al hacer push a `main` con cambios en `supabase/migrations/**`, el workflow `.github/workflows/migrate.yml` corre `supabase link` y `supabase db push --remote`. También se puede lanzar a mano (Actions → "Migrar producción" → Run workflow).
- **CI:** `.github/workflows/ci.yml` corre lint, tipos, tests, build, migraciones + pgTAP y (en `main`) el e2e.

## Vincular y migrar a mano

```bash
pnpm supabase login
pnpm supabase link --project-ref <project-ref>   # pide la contraseña de la base
# Ojo: la CLI 3.x apunta a la base LOCAL por defecto; para producción hay que pasar --remote.
pnpm supabase db push --remote
```

El *project ref* no es secreto (está en la URL del proyecto). La contraseña de la base va en el gestor de contraseñas, nunca en el repo.

## Secrets de GitHub (workflow de migraciones)

Se cargan con `gh secret set NOMBRE` (pide el valor por consola) o en GitHub → Settings → Secrets and variables → Actions:

| Secret | Para qué |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Token personal de Supabase (Account → Access Tokens) para que la CLI se loguee |
| `SUPABASE_DB_PASSWORD` | Contraseña de la base de `recetario-prod` |
| `SUPABASE_PROJECT_REF` | Identificador del proyecto de producción |

## Variables de entorno

Los nombres están en `.env.example`. Local: `.env.local` (nunca se commitea). Producción: Vercel → Settings → Environment Variables (marcar **Production** y **Preview**).

| Variable | Para qué | Dónde se carga |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | URL pública de la app (links, redirects de auth) | `.env.local` (`http://localhost:3000`) · Vercel (dominio de Vercel) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | `.env.local` (de `pnpm supabase status`) · Vercel |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública de Supabase (respeta RLS) | `.env.local` · Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servidor, ignora RLS. Solo servidor | `.env.local` · Vercel |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Errores (opcional: sin ellas queda desactivado) | Vercel |
| `ANTHROPIC_API_KEY` | Claude (IA). Solo servidor | `.env.local` · Vercel |
| `TRANSCRIPTION_PROVIDER` | Proveedor de voz → texto (`openai`) | `.env.local` · Vercel |
| `OPENAI_API_KEY` | Transcripción con `gpt-4o-transcribe`. Solo servidor | `.env.local` · Vercel |
| `CRON_SECRET` | Protege `/api/cron/tick`, que dispara `pg_cron` de Supabase (recordatorios) | `.env.local` · Vercel · en el cron de Supabase |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Clave pública de Web Push (el navegador la usa para suscribirse) | `.env.local` · Vercel |
| `VAPID_PRIVATE_KEY` | Clave privada de Web Push. Solo servidor | `.env.local` · Vercel |
| `VAPID_SUBJECT` | Identifica al remitente ante los servicios de push (URL del sitio o `mailto:`) | `.env.local` · Vercel |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Analytics (opcional) | Vercel |

Las variables de los demás servicios (Web Push) están en esta tabla.

## Verificación de producción

1. El deploy de Vercel está en verde.
2. `https://<dominio>/api/health` responde `{"ok":true,"db":true}`.
3. La URL abre en el celular y se puede instalar como app (Android: "Instalar app"; iOS: Compartir → "Agregar a inicio").

## Tareas largas y programadas (sin cola)

No se usa Inngest ni workers (decisión de simplicidad). La IA corre en Route Handlers con **streaming (SSE)** y guarda cada paso como borrador. Lo programado (recordatorios push, Etapa 10) lo dispara `pg_cron` de Supabase llamando a `POST /api/cron/tick` con `Authorization: Bearer $CRON_SECRET`. El alta del cron se documenta acá en la Etapa 10.

## Email de las cuentas

El login es con email y contraseña y **Confirm email está desactivado**, así que hoy no se manda ningún mail. Si más adelante se agrega recuperar contraseña o confirmar emails, conviene configurar un SMTP propio en Supabase (el de por defecto manda muy pocos mails por hora).

## Notificaciones push (VAPID)

Las claves VAPID ya están generadas en `.env.local` (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). **Pendiente:** cargarlas en Vercel (Production y Preview) antes de implementar la Etapa 10 (T10.1), que es la primera que las usa. Si hace falta regenerarlas: `pnpm dlx web-push generate-vapid-keys` (los usuarios ya suscriptos tendrían que volver a suscribirse).
