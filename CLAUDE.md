# CLAUDE.md — Recetario (nombre provisorio)

Recetario familiar compartido por grupos, con perfil alimentario, plan semanal con IA, lista de compras, meal prep y modo cocinar tipo stories.

- Spec de producto y técnico: `docs/SPEC.md`
- Plan de desarrollo (tareas a ejecutar): `docs/plan/README.md`

## Cómo trabajar en este repo

1. **Una tarea por sesión.** Ejecutá solo la tarea pedida (`T<etapa>.<n>`). Leé antes su archivo de etapa en `docs/plan/` y las secciones del spec que cita.
2. **No adelantes trabajo** de otras tareas. Si algo de otra tarea bloquea, decilo y pará.
3. **Si una decisión no está en el spec ni en el plan**, elegí la opción más simple, dejala anotada en la sección "Notas de ejecución" del archivo de la etapa y seguí.
4. **Pasos marcados 👤** los hace la persona (cuentas, claves, consolas web). No los simules: pedíselos y esperá.
5. **Al terminar:** corré la verificación de la tarea, marcá `[x]` en el archivo de la etapa y en la tabla de `docs/plan/README.md`, y hacé un commit `T2.3: <resumen>`.

## Stack

- Next.js (App Router, última estable) + TypeScript estricto + React Server Components.
- Tailwind CSS + shadcn/ui. Framer Motion solo en modo cocinar y transiciones.
- Supabase: Postgres + Auth + Storage + Realtime. Cliente `@supabase/ssr` + `@supabase/supabase-js` con tipos generados.
- **Sin ORM.** El esquema vive en migraciones SQL (`supabase/migrations`). Los tipos salen de `pnpm db:types` → `lib/supabase/database.types.ts`.
- Zod v4 para validar forms, inputs de API y salidas de IA.
- IA: `@anthropic-ai/sdk`. Modelos en `lib/ai/models.ts` (`claude-sonnet-5-5`, `claude-haiku-5-5`). Nunca hardcodear el ID del modelo fuera de ese archivo.
- Tests: Vitest (unit), Playwright (e2e en viewport mobile 390×844), pgTAP vía `supabase test db` (RLS).
- Gestor de paquetes: **pnpm**.

## Comandos

```bash
pnpm dev             # app en http://localhost:3000
pnpm lint            # ESLint
pnpm typecheck       # tsc --noEmit
pnpm test            # Vitest
pnpm test:e2e        # Playwright (requiere supabase local levantado)
pnpm db:start        # supabase start (requiere Docker Desktop)
pnpm db:reset        # recrea la DB local aplicando migraciones + seed
pnpm db:test         # supabase test db (pgTAP)
pnpm db:types        # regenera lib/supabase/database.types.ts
pnpm check           # lint + typecheck + test (lo mínimo antes de cada commit)
```

## Estructura

```
app/
  (auth)/login, auth/callback
  (app)/g/[groupId]/hoy | recetas | plan | compras
  (app)/perfil, (app)/grupos
  join/[token]        r/[token]       api/...
components/           ui/ (shadcn), y carpetas por feature (recipes/, cooking/, plan/, shopping/...)
lib/
  domain/             lógica pura y testeada: unidades, parser de ingredientes, escalado,
                      compatibilidad, validatePlan, armado de lista. SIN imports de DB ni IA.
  schemas/            esquemas Zod compartidos
  supabase/           clientes server/browser/admin + database.types.ts
  ai/                 cliente, models.ts, runStructured, prompts/, tools/
  transcription/
  brand.ts            nombre y textos de marca (único lugar)
supabase/migrations/  SQL, numeradas por timestamp
supabase/tests/       pgTAP
tests/e2e/            Playwright
tests/evals/          casos de evaluación de IA (no corren en CI)
```

## Convenciones

- **Idioma:** código, identificadores y commits en inglés. **Todo texto visible en español rioplatense con voseo** ("Agregá", "Tocá para grabar").
- **Mobile-first:** diseñá para 375 px de ancho. Áreas táctiles ≥ 44 px. Probá en ese viewport.
- **Seguridad:**
  - Toda tabla nueva tiene RLS habilitado y policies en la misma migración. Sin excepciones.
  - El cliente admin (service role) solo se usa en código de servidor, y solo cuando una tarea lo indica (tokens públicos, invitaciones, jobs).
  - Operaciones que tocan varias tablas → función SQL (RPC) transaccional.
- **Migraciones:** nunca edites una migración ya commiteada; creá una nueva. Después de migrar: `pnpm db:reset && pnpm db:types`.
- **Server Actions** para mutaciones de UI; **Route Handlers** (`app/api`) para IA, streaming, webhooks y endpoints públicos.
- **IA:** toda llamada pasa por `lib/ai/runStructured` (o el loop de agente del plan). Se registra en `ai_runs`. Las salidas se validan con Zod y luego con los validadores de `lib/domain`. Lo que genera la IA se guarda como borrador hasta que el usuario confirma.
- **Restricciones alimentarias:** se validan por código (`lib/domain/compatibility.ts`), nunca solo por prompt.
- **Dependencias:** no agregues paquetes que no estén en el plan sin justificarlo en "Notas de ejecución".
- **Tests:** todo lo de `lib/domain` lleva tests unitarios. Cada etapa cierra con al menos un e2e del flujo principal.
- **Variables de entorno:** documentadas en `.env.example`. Nunca commitear `.env*.local`.
