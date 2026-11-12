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
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Analytics (opcional) | Vercel |

Las variables de los demás servicios (Anthropic, transcripción, Inngest, Web Push) se agregan en las secciones siguientes a medida que se configuran.

## Verificación de producción

1. El deploy de Vercel está en verde.
2. `https://<dominio>/api/health` responde `{"ok":true,"db":true}`.
3. La URL abre en el celular y se puede instalar como app (Android: "Instalar app"; iOS: Compartir → "Agregar a inicio").
