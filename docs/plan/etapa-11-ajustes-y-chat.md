# Etapa 11 — Ajustes de uso real y chat general

**Resultado:** la app no se "sale" del grupo, navega rápido, deja ver qué pasó (logs de actividad) y tiene un chat general desde cualquier pantalla para preguntar sobre alimentación o llegar a una sección.
**Origen:** notas de la prueba real del 12/11/2026.

### [x] T11.1 — Contexto de grupo y velocidad de navegación
- **Problema:** fuera de `/g/<id>` (Perfil, Grupos…) la barra inferior y el selector caían al grupo personal; cada pantalla repetía la verificación de sesión por red y las queries en serie; sin feedback mientras carga.
- **Pasos:** último grupo visitado (cookie `last_group_id`) como default en layout, barra y selector; `requireUser` con `cache()` + `getClaims()` (sin ir a la red de Auth en cada llamada); `getMyGroups` cacheada por request; `loading.tsx` con esqueleto; documentar la región de Vercel (debe ser la de Supabase) en `docs/deploy.md`.
- **Aceptación:** e2e: desde Perfil, "Plan" vuelve al último grupo; navegar entre pestañas muestra el esqueleto al instante.

### [x] T11.2 — Registro de actividad
- **Pasos:** tabla `activity_events` (user_id, group_id, kind, path, meta, created_at) con RLS (cada persona ve lo suyo); helper `logEvent`; eventos de servidor en acciones clave (login, aprobar plan, generar lista, cocinar, importar, compartir, errores de IA); beacon liviano de navegación; pantalla Perfil → Actividad (lo propio) y guía en `docs/deploy.md` de dónde ver los logs de Vercel/Supabase.
- **Aceptación:** al navegar y aprobar un plan aparecen los eventos en Perfil → Actividad.

### [ ] T11.3 — Chat general
- **Pasos:** botón de chat visible en todas las pantallas del grupo (arriba, junto al selector); el asistente gana `navigate_to` (tarjeta con link a Hoy, Recetas, Plan, Compras, Mi plan, Perfil, Explorar…) y respuestas sobre alimentación usando `get_my_diet_plan` y el perfil; saludo y sugerencias ("¿Qué ceno hoy?", "Llevame a la lista de compras").
- **Aceptación:** "llevame a mi plan de alimentación" devuelve una tarjeta que abre `/perfil/plan`; "¿qué ceno que encaje en mi plan?" usa el plan vivo.

- T11.1: Auth con cache() + getClaims, getMyGroups cacheada, loading.tsx, default al último grupo; región de Vercel documentada (👤 elegir la misma región que Supabase).

- T11.2: activity_events (RLS propia, purga a 90 días desde el cron). Admin ve todo desde el SQL editor de Supabase.
