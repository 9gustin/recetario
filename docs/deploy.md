# Deploy y operación

Producción: **Vercel** (app) + **Supabase** `recetario-prod` (región São Paulo). Las migraciones se aplican a producción con GitHub Actions.

- **Project ref de producción:** `fsqielfvruyhzietrgxn` (URL: `https://fsqielfvruyhzietrgxn.supabase.co`). No es secreto.
- **Claves:** Supabase ahora entrega *publishable key* (`sb_publishable_…`, pública) y *secret key* (`sb_secret_…`, solo servidor). La app las lee como `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` respectivamente (los nombres no cambian).

- **URL de producción:** https://recetario-lime-kappa.vercel.app

## Cómo se despliega

- **App:** cada push a `main` despliega a producción en Vercel; cada PR/rama genera un preview.
- **Base de datos:** al hacer push a `main` con cambios en `supabase/migrations/**`, el workflow `.github/workflows/migrate.yml` corre `supabase link` y `supabase db push --remote --yes` (la CLI 3.x exige `--yes` cuando no hay terminal). También se puede lanzar a mano (Actions → "Migrar producción" → Run workflow).
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

Las claves VAPID ya están generadas en `.env.local` (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). Ya están cargadas en Vercel (Production y Preview). Si hace falta regenerarlas: `pnpm dlx web-push generate-vapid-keys` (los usuarios ya suscriptos tendrían que volver a suscribirse).

## Notificaciones push y recordatorios (T10.1)

1. Variables en Vercel (Production y Preview): `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (un `mailto:` tuyo) y `CRON_SECRET` (un string largo al azar). Las claves salen de `pnpm dlx web-push generate-vapid-keys`.
2. Cron: en Supabase → SQL editor, con las extensiones `pg_cron` y `pg_net` habilitadas (Database → Extensions):

```sql
select cron.schedule(
  'recetario-tick',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://TU-DOMINIO.vercel.app/api/cron/tick',
    headers := jsonb_build_object('Authorization', 'Bearer TU_CRON_SECRET', 'Content-Type', 'application/json')
  );
  $$
);
```

3. En iPhone las notificaciones solo funcionan con la app instalada en la pantalla de inicio (la pantalla de Notificaciones lo explica).

## Región y velocidad (T11.1)

Las funciones de Vercel tienen que correr en la **misma región que Supabase**; si no, cada consulta cruza continentes y la navegación se siente lenta.
1. Supabase → Project Settings → General → mirá la región (p. ej. `South America (São Paulo)`).
2. Vercel → Project → Settings → Functions → *Function Region* → elegí la más cercana (São Paulo = `gru1`) y redeployá.
3. La verificación de sesión usa `getClaims()` (local) y se cachea por request, así que cada pantalla hace menos viajes a la red.

## Dónde ver los logs (T11.2)

- **Lo que hace cada persona:** en la app, Perfil → Actividad (privado, 90 días). Para analizar todo junto, en Supabase → SQL editor: `select kind, count(*) from activity_events group by 1 order by 2 desc;` (el editor corre como administrador y ve todos).
- **Errores y rendimiento del servidor:** Vercel → Project → Logs (filtrá por `Error`) y Observability.
- **Llamadas a la IA (costo, errores, latencia):** tabla `ai_runs` en Supabase.

## Catálogo público y sitio de exploración (Etapa 12)

1. Variable en Vercel: `NEXT_PUBLIC_SITE_URL` = la URL pública (la usan el sitemap, robots y los links para compartir).
2. Aplicar las migraciones (`pnpm exec supabase db push --remote`).
3. Cargar el catálogo en producción (idempotente, se puede repetir; no duplica):

```bash
# .env.prod con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de producción
CATALOG_ENV_FILE=.env.prod pnpm catalog:load
```

4. Generar más recetas (cuesta ~US$ 0,015 cada una): `pnpm catalog:generate` (sigue donde quedó; agregá pedidos nuevos en `scripts/catalog/briefs.ts`) y después `pnpm catalog:load`.
5. Lo público se lee solo por RPC (`search_public_recipes`, `get_published_recipe`, `get_public_collection`, `get_public_plan`); las tablas siguen cerradas para usuarios sin sesión.

## Nutricionistas (etapa 14)
- Aplicá las migraciones `20261113090000_flexible_plans.sql`, `20261113100000_meal_list.sql` y `20261113110000_professionals.sql`.
- Para invitar a un profesional: `CATALOG_ENV_FILE=.env.prod pnpm pro:invite "Lic. Nombre" 1 30` y pasale el código; lo canjea en `/profesionales`.
