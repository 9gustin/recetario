# Etapa 1 — Auth y grupos

**Resultado:** me registro y entro con email y contraseña, creo el grupo "Casa", le paso el link de invitación a mi pareja y ella se une con su cuenta.
**Spec:** §3 F1, F2 · §5.2 (Identidad y grupos) · §5.3 (RLS).

---

### [x] T1.1 — Migración: perfiles, grupos, miembros, invitaciones
- **Depende de:** T0.5
- **Archivos:** `supabase/migrations/<ts>_groups.sql`.
- **Pasos:**
  1. Tablas `profiles`, `groups`, `group_members`, `group_invites` según §5.2. `updated_at` con trigger genérico `set_updated_at()`.
  2. Funciones (`security definer`, `set search_path = public`, `stable` donde aplique):
     - `is_group_member(gid uuid) returns boolean`
     - `group_role(gid uuid) returns text`
  3. Trigger `on_auth_user_created` sobre `auth.users`: crea el `profile` (nombre y avatar desde `raw_user_meta_data`), crea el grupo personal "Mis recetas" (`is_personal = true`), agrega al usuario como `owner` y guarda `profiles.personal_group_id`.
  4. RLS:
     - `profiles`: select si es uno mismo **o** si comparte algún grupo; update solo uno mismo.
     - `groups`: select si `is_group_member(id)`; insert si `created_by = auth.uid()`; update si rol owner/admin.
     - `group_members`: select si es miembro del grupo; delete si es uno mismo (salir) o el rol es owner/admin. Insert solo vía RPC.
     - `group_invites`: select/insert/update solo owner/admin del grupo.
  5. RPCs:
     - `create_group(name text, emoji text) returns uuid`: crea el grupo y el owner en una transacción.
     - `accept_invite(p_token text) returns uuid` (security definer): valida que exista, no esté revocada, no vencida y con usos disponibles; inserta al miembro (idempotente si ya es miembro), incrementa `uses` y devuelve `group_id`.
     - `get_invite_preview(p_token text)`: devuelve nombre del grupo, emoji, quién invita y la cantidad de miembros (para la pantalla de "Te invitaron a…"). Accesible a `anon`.
     - `leave_group(gid uuid)`: si es el último owner, promueve al admin más antiguo o, si no hay, al miembro más antiguo; si queda vacío, `archived_at = now()`. No se puede salir del grupo personal.
     - `remove_member(gid uuid, uid uuid)`: solo owner/admin; un admin no puede sacar a un owner.
- **Aceptación:** `pnpm db:reset` sin errores; crear un usuario en Studio genera perfil y grupo personal.
- **Verificación:** `pnpm db:reset && pnpm db:types`; revisar en Studio (http://localhost:54323).
- **Fuera de alcance:** UI.

### [x] T1.2 — Tests de RLS (pgTAP)
- **Depende de:** T1.1
- **Archivos:** `supabase/tests/01_groups_rls.test.sql`, helpers en `supabase/tests/00_helpers.sql`.
- **Pasos:**
  1. Helper para crear usuarios de prueba y simular sesión (`set local role authenticated; set local request.jwt.claims = '{"sub":"…"}'`).
  2. Casos: A no ve grupos de B · A no puede insertar en `group_members` directo · `accept_invite` con token vencido/revocado falla · con token válido une a B · B ve el perfil de A después de unirse · un member no puede crear invitaciones · `leave_group` transfiere ownership · no se puede salir del grupo personal.
- **Aceptación:** `pnpm db:test` en verde con todos los casos.

### [x] T1.3 — Login (email + contraseña)
- **Depende de:** T1.1. Auth por email + contraseña (decisión de simplicidad: sin Google ni magic link). En prod, "Confirm email" está desactivado en Supabase para no depender de SMTP.
- **Archivos:** `app/(auth)/login/page.tsx`, `app/auth/callback/route.ts`, `app/auth/signout/route.ts`, `lib/auth.ts`, `middleware.ts`.
- **Pasos:**
  1. Pantalla de login cálida: logo, tagline, formulario de email + contraseña con dos modos ("Entrar" y "Crear cuenta"; en el alta, también nombre). Errores claros en español (contraseña corta, email ya registrado, datos incorrectos). Sin recuperar contraseña por ahora.
  2. `auth/callback`: intercambia el código por sesión y redirige a `next` (validar que sea una ruta interna) o a `/`.
  3. `middleware.ts`: rutas bajo `(app)` requieren sesión → redirige a `/login?next=…`. Públicas: `/login`, `/auth/*`, `/join/*`, `/r/*`, `/api/health`, assets.
  4. `lib/auth.ts`: `requireUser()` para Server Components/Actions.
  5. Perfil: en `/perfil`, mostrar nombre/foto, editar nombre y "Cerrar sesión".
  6. Local: las cuentas se crean sin confirmar el email (`enable_confirmations = false`).
- **Aceptación:** alta y login con email y contraseña en local y en producción; al cerrar y reabrir la PWA sigue logueado.
- **Verificación:** prueba manual + `pnpm check`.

### [x] T1.4 — Grupo activo y selector
- **Depende de:** T1.3
- **Archivos:** `app/page.tsx`, `app/(app)/g/[groupId]/layout.tsx`, `components/groups/group-switcher.tsx`, `lib/groups/queries.ts`.
- **Pasos:**
  1. `app/page.tsx`: si hay sesión, redirige a `/g/<último grupo>/hoy` (cookie `last_group_id`) o al grupo personal.
  2. Layout `g/[groupId]`: verifica membresía (si no es miembro → 404) y guarda la cookie.
  3. Selector en la barra superior: `Sheet` con la lista de mis grupos (emoji + nombre + cantidad de miembros), el activo marcado, y al final "Crear grupo" y "Administrar grupos".
  4. Reemplazar la ruta `demo` de T0.3.
- **Aceptación:** cambio de grupo en dos toques; la URL refleja el grupo activo.

### [x] T1.5 — Administrar grupos
- **Depende de:** T1.4
- **Archivos:** `app/(app)/grupos/page.tsx`, `app/(app)/grupos/nuevo/page.tsx`, `app/(app)/grupos/[id]/page.tsx`, `lib/groups/actions.ts`, `lib/schemas/group.ts`.
- **Pasos:**
  1. Lista de mis grupos con rol.
  2. Crear grupo: nombre + emoji (selector simple de ~30 emojis de comida y casa) → `create_group` → redirige al grupo.
  3. Ajustes del grupo: renombrar, emoji, miembros (avatar, nombre, rol), sacar miembro (confirmación), cambiar rol (owner/admin), salir del grupo.
  4. El grupo personal no muestra "Invitar" ni "Salir"; muestra "Para compartir con otras personas, creá un grupo".
- **Aceptación:** todas las acciones respetan roles (los botones no aparecen si no corresponde y el servidor también lo rechaza).

### [x] T1.6 — Invitaciones por link
- **Depende de:** T1.5
- **Archivos:** `components/groups/invite-sheet.tsx`, `lib/groups/invites.ts`, `app/join/[token]/page.tsx`, `app/join/[token]/accept/route.ts`.
- **Pasos:**
  1. "Invitar" en ajustes del grupo → genera token (`crypto.randomBytes(24).toString("base64url")`), vencimiento 7 días, usos ilimitados.
  2. Sheet con el link, botón "Compartir" (`navigator.share` con texto "Sumate a *Casa* en Recetario") y fallback "Copiar".
  3. Lista de invitaciones activas con "Revocar".
  4. `/join/[token]`: usa `get_invite_preview`. Si es inválida/vencida → mensaje amable. Si no hay sesión → "Entrá para unirte" → login con `next=/join/<token>`. Con sesión → botón "Unirme" → `accept_invite` → redirige a `/g/<id>/hoy` con toast "¡Te uniste a Casa!".
  5. Si ya es miembro → redirige directo.
- **Aceptación:** flujo completo con dos cuentas (dos navegadores).

### T1.7 — E2E de grupos
- **Depende de:** T1.6
- **Archivos:** `tests/e2e/helpers/auth.ts`, `tests/e2e/groups.spec.ts`.
- **Pasos:**
  1. Helper de login para tests: crear usuario con el cliente admin y generar sesión con `auth.admin.generateLink` o con usuario/contraseña.
  2. Escenario: A crea "Casa" → genera invitación → B abre el link, se loguea, se une → B ve "Casa" en el selector → A ve a B en miembros → A revoca la invitación → C no puede unirse.
- **Aceptación:** `pnpm test:e2e` en verde.

---

## Cierre de la Etapa 1
- [ ] Deploy en prod con auth por email y contraseña 👤.
- [ ] Prueba real: mi pareja se une desde su celular.
- [ ] Revisión de RLS (🧠 recomendado con Opus): leer todas las policies y buscar huecos.

## Notas de ejecución

- T1.1: se agregó la función helper `shares_group_with(uid)` (security definer, stable) para la policy de `profiles` ("ver el perfil de quien comparte algún grupo") sin recursión de RLS. `group_members` no lleva `updated_at` (join table con `joined_at`, según §5.2). `create_group`/`accept_invite`/`leave_group`/`remove_member` quedan revocadas a `anon` (solo `get_invite_preview` es accesible a anon); el alta de usuario crea perfil + grupo personal "Mis recetas" + membresía owner vía trigger `on_auth_user_created`.

- T1.2: `supabase/tests/00_helpers.sql` (sin `BEGIN/ROLLBACK`) crea el helper `tests.create_user(id, email, name)` con `security definer`, que inserta en `auth.users` y dispara el alta de perfil + grupo personal; emite un test trivial para que pg_prove vea un plan válido (pg_prove descubre **todos** los `**/*.sql` de `supabase/tests`). La sesión se simula con `set local role authenticated;` + `select set_config('request.jwt.claims', …)`. Se usan UUIDs fijos para evitar interpolación de psql. El caso de transferencia de ownership usa un tercer usuario C (admin), para no ensuciar el caso "B se une por invitación". `\set QUIET 1` evita que los command tags de psql ensucien el TAP.

- T1.3: **`zod` no estaba instalado** (lo declaran CLAUDE.md y SPEC §4.1, pero no se agregó en la Etapa 0); se instaló `zod@4.6.7` para validar el Server Action de perfil. El "middleware" de la tarea es en realidad `proxy.ts` (Next 16 renombró `middleware`→`proxy`; ver nota T0.5): la lógica vive en `lib/supabase/middleware.ts` (`updateSession`), que ahora protege `/g/*`, `/perfil` y `/grupos` y devuelve los logueados en `/login` a la home. El login se dividió en `app/(auth)/login/page.tsx` (server, lee `searchParams`) + `components/auth/login-form.tsx` (client) para evitar el `Suspense` de `useSearchParams()`. No hay recuperación de contraseña (fuera de alcance). Alta y login con email+contraseña; al registrarse se pasa `display_name` a `raw_user_meta_data`.

- T1.4: la cookie `last_group_id` se escribe en el `proxy.ts`/`updateSession` (los Server Components no pueden escribir cookies). `BottomNav` recibe `defaultGroupId` (grupo personal) para resolver los tabs en `/perfil`, que no tiene `groupId` en la URL. La membresía se valida en `app/(app)/g/[groupId]/layout.tsx` (404 si no es miembro o el grupo no existe). Los botones "Crear grupo"/"Administrar grupos" del selector apuntan a `/grupos/nuevo` y `/grupos`, que se implementan en T1.5 (dan 404 hasta entonces, por diseño incremental). Se quitó `DEMO_GROUP_ID` de T0.3.

- T1.5: para "cambiar rol" hizo falta una migración nueva (`20261112013000_set_member_role.sql`) con el RPC `set_member_role(gid, uid, role)` (`security definer`): solo un `owner` puede cambiar roles, no puede cambiarse a sí mismo, y se revoca a `anon`. Renombrar/emoji usan `update` directo sobre `groups` (la policy `groups_update_owner_admin` de T1.1 ya lo restringe a owner/admin); sacar miembro usa `remove_member` y salir usa `leave_group` (T1.1). El tipo generado marca `p_emoji` de `create_group` como `string` aunque el parámetro SQL es nullable: se castea al llamar al RPC.

- T1.6: el token se genera con `crypto.randomBytes(24).toString("base64url")` (7 días, `max_uses` nulo = usos ilimitados) en un Server Action (`lib/groups/invites.ts`). Crear/revocar invitaciones usan el cliente normal: la RLS de `group_invites` (owner/admin) ya lo restringe. La página `/join/[token]` usa `get_invite_preview` (accesible a `anon`) y chequea la sesión sin redirigir; si el usuario ya es miembro redirige directo. El toast "¡Te uniste a X!" se pasa por query `?joined=` y lo muestra `JoinToast` (envuelto en `Suspense`) desde el layout de grupo. Un `member` que abre ajustes no ve invitaciones: la RLS le devuelve lista vacía (no error).
