# Prompts — Etapa 01: Auth y grupos

Copiá y pegá cada bloque **en orden**, cada uno en una sesión nueva. Plan de la etapa: [`docs/plan/etapa-01-auth-grupos.md`](../../plan/etapa-01-auth-grupos.md).

| Paso | Quién | Qué |
|---|---|---|
| 1 | Sonnet (Claude Code) | Configuración puntual + crear rama |
| 2 | DeepSeek | T1.1 — Migración: perfiles, grupos, miembros, invitaciones |
| 3 | DeepSeek | T1.2 — Tests de RLS (pgTAP) |
| 4 | DeepSeek | T1.3 — Login (Google + magic link) |
| 5 | DeepSeek | T1.4 — Grupo activo y selector |
| 6 | DeepSeek | T1.5 — Administrar grupos |
| 7 | DeepSeek | T1.6 — Invitaciones por link |
| 8 | DeepSeek | T1.7 — E2E de grupos |
| 9 | Sonnet (Claude Code) | Revisión de la etapa y merge |
| 10 | DeepSeek → Sonnet | Solo si la revisión dejó fixes |

---

## 1 · Sonnet — configuración puntual

```text
Sos el responsable de configuración del proyecto en ~/projects/recetario (WSL).

Leé CLAUDE.md, docs/execution/README.md, docs/execution/01-configuracion-sonnet.md (sección C) y docs/plan/etapa-01-auth-grupos.md.

Hacé solo la configuración puntual de esta etapa (Google OAuth (login con Google) en Google Cloud y Supabase, local y producción), según la tabla de la sección C de docs/execution/01-configuracion-sonnet.md. No escribas código de la etapa: eso lo hace otro agente.

Reglas:
- Los pasos en consolas web los hago yo: guiame paso a paso y esperá mi confirmación.
- Nunca me pidas claves en el chat. Decime en qué archivo o panel van (.env.local, Vercel, secrets de GitHub, supabase/config.toml).
- Lo que se pueda dejar en el repo (config.toml, .env.example, docs/deploy.md) dejalo commiteado en main con el mensaje "config(etapa-01): <resumen>".
- Creá la rama etapa-01 desde main y subila: `git checkout main && git pull && git checkout -b etapa-01 && git push -u origin etapa-01`.
- Al final, verificá que la configuración funciona y decime qué quedó listo.
```

## 2 · DeepSeek — T1.1: Migración: perfiles, grupos, miembros, invitaciones

```text
Vas a implementar UNA tarea de un proyecto Next.js + Supabase. Trabajás en ~/projects/recetario, en la rama etapa-01.

TAREA: T1.1 — Migración: perfiles, grupos, miembros, invitaciones
ARCHIVO DE LA ETAPA: docs/plan/etapa-01-auth-grupos.md
DISEÑO DE REFERENCIA: ninguno (seguí la sección 3 de docs/design/README.md si la tarea tiene pantallas)

PASO 0 — RAMA
Corré `git checkout etapa-01 && git pull` y `git status`. Si hay cambios sin commitear que no son tuyos, frená y avisame.

PASO 1 — LEER (no escribas código todavía)
a) CLAUDE.md completo.
b) docs/execution/02-codigo-deepseek.md, secciones 2 y 6.
c) En docs/plan/etapa-01-auth-grupos.md: la tarea T1.1 completa y las tareas que figuran en su "Depende de".
d) Las secciones de docs/SPEC.md que la tarea cita en "Spec".
e) docs/design/README.md (secciones 1, 2 y 3) y el diseño de referencia indicado arriba.
f) Los archivos que ya existen y vas a modificar o usar. Corré `git log --oneline -15` para ver qué se hizo antes.

PASO 2 — PLAN
Escribí un plan corto:
- Lista exacta de archivos a crear y a modificar.
- Para cada criterio de "Aceptación" de la tarea, cómo lo vas a cumplir.
- Dudas: si algo no está definido en el plan ni en el spec, decilo ahora y elegí la opción más simple.

PASO 3 — IMPLEMENTAR
Seguí los "Pasos" de la tarea en orden. Reglas obligatorias:
- Solo esta tarea. Nada de lo que diga "Fuera de alcance".
- No agregues dependencias que la tarea no nombre.
- Migraciones: archivo nuevo en supabase/migrations/ con RLS y policies; nunca edites una migración ya commiteada; después `pnpm db:reset && pnpm db:types`.
- UI: mobile-first a 390 px de ancho. Igual al diseño de referencia en estructura, tamaños, espaciados y jerarquía. Colores SOLO con tokens del tema (nunca hex). Títulos con `font-display`. Íconos de lucide-react. Áreas táctiles de 44 px o más. Textos en español con voseo. Estados de carga, vacío y error.
- Reutilizá los componentes existentes de components/ antes de crear nuevos.
- Copiá los patrones de la sección 6 de docs/execution/02-codigo-deepseek.md (si el código existente difiere, gana el código existente).
- Nunca escribas claves ni uses el cliente admin si la tarea no lo pide.

PASO 4 — VERIFICAR
- Corré la "Verificación" de la tarea y `pnpm check`. Si tocaste la base, también `pnpm db:test`.
- Si algo falla, arreglalo. Nunca borres ni debilites un test. Si falla 3 veces por la misma causa, frená y explicá.
- Revisá uno por uno los criterios de "Aceptación" y decí si se cumplen.

PASO 5 — CERRAR
- Marcá [x] la tarea T1.1 en docs/plan/etapa-01-auth-grupos.md y en el tablero de docs/plan/README.md.
- Si tomaste decisiones que no estaban en el plan, anotalas en "Notas de ejecución" de docs/plan/etapa-01-auth-grupos.md.
- Commit: `git add -A && git commit -m "T1.1: <resumen corto en inglés>"` y `git push`.

RESPUESTA FINAL (en español):
1. Qué hiciste (archivos).
2. Cada criterio de aceptación: cumplido / no cumplido.
3. Resultado de las pruebas.
4. Cómo lo pruebo a mano (URL y pasos).
5. Decisiones o dudas para la revisión.
```

## 3 · DeepSeek — T1.2: Tests de RLS (pgTAP)

```text
Vas a implementar UNA tarea de un proyecto Next.js + Supabase. Trabajás en ~/projects/recetario, en la rama etapa-01.

TAREA: T1.2 — Tests de RLS (pgTAP)
ARCHIVO DE LA ETAPA: docs/plan/etapa-01-auth-grupos.md
DISEÑO DE REFERENCIA: ninguno (seguí la sección 3 de docs/design/README.md si la tarea tiene pantallas)

PASO 0 — RAMA
Corré `git checkout etapa-01 && git pull` y `git status`. Si hay cambios sin commitear que no son tuyos, frená y avisame.

PASO 1 — LEER (no escribas código todavía)
a) CLAUDE.md completo.
b) docs/execution/02-codigo-deepseek.md, secciones 2 y 6.
c) En docs/plan/etapa-01-auth-grupos.md: la tarea T1.2 completa y las tareas que figuran en su "Depende de".
d) Las secciones de docs/SPEC.md que la tarea cita en "Spec".
e) docs/design/README.md (secciones 1, 2 y 3) y el diseño de referencia indicado arriba.
f) Los archivos que ya existen y vas a modificar o usar. Corré `git log --oneline -15` para ver qué se hizo antes.

PASO 2 — PLAN
Escribí un plan corto:
- Lista exacta de archivos a crear y a modificar.
- Para cada criterio de "Aceptación" de la tarea, cómo lo vas a cumplir.
- Dudas: si algo no está definido en el plan ni en el spec, decilo ahora y elegí la opción más simple.

PASO 3 — IMPLEMENTAR
Seguí los "Pasos" de la tarea en orden. Reglas obligatorias:
- Solo esta tarea. Nada de lo que diga "Fuera de alcance".
- No agregues dependencias que la tarea no nombre.
- Migraciones: archivo nuevo en supabase/migrations/ con RLS y policies; nunca edites una migración ya commiteada; después `pnpm db:reset && pnpm db:types`.
- UI: mobile-first a 390 px de ancho. Igual al diseño de referencia en estructura, tamaños, espaciados y jerarquía. Colores SOLO con tokens del tema (nunca hex). Títulos con `font-display`. Íconos de lucide-react. Áreas táctiles de 44 px o más. Textos en español con voseo. Estados de carga, vacío y error.
- Reutilizá los componentes existentes de components/ antes de crear nuevos.
- Copiá los patrones de la sección 6 de docs/execution/02-codigo-deepseek.md (si el código existente difiere, gana el código existente).
- Nunca escribas claves ni uses el cliente admin si la tarea no lo pide.

PASO 4 — VERIFICAR
- Corré la "Verificación" de la tarea y `pnpm check`. Si tocaste la base, también `pnpm db:test`.
- Si algo falla, arreglalo. Nunca borres ni debilites un test. Si falla 3 veces por la misma causa, frená y explicá.
- Revisá uno por uno los criterios de "Aceptación" y decí si se cumplen.

PASO 5 — CERRAR
- Marcá [x] la tarea T1.2 en docs/plan/etapa-01-auth-grupos.md y en el tablero de docs/plan/README.md.
- Si tomaste decisiones que no estaban en el plan, anotalas en "Notas de ejecución" de docs/plan/etapa-01-auth-grupos.md.
- Commit: `git add -A && git commit -m "T1.2: <resumen corto en inglés>"` y `git push`.

RESPUESTA FINAL (en español):
1. Qué hiciste (archivos).
2. Cada criterio de aceptación: cumplido / no cumplido.
3. Resultado de las pruebas.
4. Cómo lo pruebo a mano (URL y pasos).
5. Decisiones o dudas para la revisión.
```

## 4 · DeepSeek — T1.3: Login (Google + magic link)

```text
Vas a implementar UNA tarea de un proyecto Next.js + Supabase. Trabajás en ~/projects/recetario, en la rama etapa-01.

TAREA: T1.3 — Login (Google + magic link)
ARCHIVO DE LA ETAPA: docs/plan/etapa-01-auth-grupos.md
DISEÑO DE REFERENCIA: docs/design/pantallas/Perfil.html (solo la cabecera) y la sección 3 de docs/design/README.md (login)

NOTA IMPORTANTE: Los pasos 👤 de esta tarea (Google OAuth) ya los hizo la configuración: no los repitas. Solo implementá el código.

PASO 0 — RAMA
Corré `git checkout etapa-01 && git pull` y `git status`. Si hay cambios sin commitear que no son tuyos, frená y avisame.

PASO 1 — LEER (no escribas código todavía)
a) CLAUDE.md completo.
b) docs/execution/02-codigo-deepseek.md, secciones 2 y 6.
c) En docs/plan/etapa-01-auth-grupos.md: la tarea T1.3 completa y las tareas que figuran en su "Depende de".
d) Las secciones de docs/SPEC.md que la tarea cita en "Spec".
e) docs/design/README.md (secciones 1, 2 y 3) y el diseño de referencia indicado arriba.
f) Los archivos que ya existen y vas a modificar o usar. Corré `git log --oneline -15` para ver qué se hizo antes.

PASO 2 — PLAN
Escribí un plan corto:
- Lista exacta de archivos a crear y a modificar.
- Para cada criterio de "Aceptación" de la tarea, cómo lo vas a cumplir.
- Dudas: si algo no está definido en el plan ni en el spec, decilo ahora y elegí la opción más simple.

PASO 3 — IMPLEMENTAR
Seguí los "Pasos" de la tarea en orden. Reglas obligatorias:
- Solo esta tarea. Nada de lo que diga "Fuera de alcance".
- No agregues dependencias que la tarea no nombre.
- Migraciones: archivo nuevo en supabase/migrations/ con RLS y policies; nunca edites una migración ya commiteada; después `pnpm db:reset && pnpm db:types`.
- UI: mobile-first a 390 px de ancho. Igual al diseño de referencia en estructura, tamaños, espaciados y jerarquía. Colores SOLO con tokens del tema (nunca hex). Títulos con `font-display`. Íconos de lucide-react. Áreas táctiles de 44 px o más. Textos en español con voseo. Estados de carga, vacío y error.
- Reutilizá los componentes existentes de components/ antes de crear nuevos.
- Copiá los patrones de la sección 6 de docs/execution/02-codigo-deepseek.md (si el código existente difiere, gana el código existente).
- Nunca escribas claves ni uses el cliente admin si la tarea no lo pide.

PASO 4 — VERIFICAR
- Corré la "Verificación" de la tarea y `pnpm check`. Si tocaste la base, también `pnpm db:test`.
- Si algo falla, arreglalo. Nunca borres ni debilites un test. Si falla 3 veces por la misma causa, frená y explicá.
- Revisá uno por uno los criterios de "Aceptación" y decí si se cumplen.

PASO 5 — CERRAR
- Marcá [x] la tarea T1.3 en docs/plan/etapa-01-auth-grupos.md y en el tablero de docs/plan/README.md.
- Si tomaste decisiones que no estaban en el plan, anotalas en "Notas de ejecución" de docs/plan/etapa-01-auth-grupos.md.
- Commit: `git add -A && git commit -m "T1.3: <resumen corto en inglés>"` y `git push`.

RESPUESTA FINAL (en español):
1. Qué hiciste (archivos).
2. Cada criterio de aceptación: cumplido / no cumplido.
3. Resultado de las pruebas.
4. Cómo lo pruebo a mano (URL y pasos).
5. Decisiones o dudas para la revisión.
```

## 5 · DeepSeek — T1.4: Grupo activo y selector

```text
Vas a implementar UNA tarea de un proyecto Next.js + Supabase. Trabajás en ~/projects/recetario, en la rama etapa-01.

TAREA: T1.4 — Grupo activo y selector
ARCHIVO DE LA ETAPA: docs/plan/etapa-01-auth-grupos.md
DISEÑO DE REFERENCIA: ninguno (seguí la sección 3 de docs/design/README.md si la tarea tiene pantallas)

PASO 0 — RAMA
Corré `git checkout etapa-01 && git pull` y `git status`. Si hay cambios sin commitear que no son tuyos, frená y avisame.

PASO 1 — LEER (no escribas código todavía)
a) CLAUDE.md completo.
b) docs/execution/02-codigo-deepseek.md, secciones 2 y 6.
c) En docs/plan/etapa-01-auth-grupos.md: la tarea T1.4 completa y las tareas que figuran en su "Depende de".
d) Las secciones de docs/SPEC.md que la tarea cita en "Spec".
e) docs/design/README.md (secciones 1, 2 y 3) y el diseño de referencia indicado arriba.
f) Los archivos que ya existen y vas a modificar o usar. Corré `git log --oneline -15` para ver qué se hizo antes.

PASO 2 — PLAN
Escribí un plan corto:
- Lista exacta de archivos a crear y a modificar.
- Para cada criterio de "Aceptación" de la tarea, cómo lo vas a cumplir.
- Dudas: si algo no está definido en el plan ni en el spec, decilo ahora y elegí la opción más simple.

PASO 3 — IMPLEMENTAR
Seguí los "Pasos" de la tarea en orden. Reglas obligatorias:
- Solo esta tarea. Nada de lo que diga "Fuera de alcance".
- No agregues dependencias que la tarea no nombre.
- Migraciones: archivo nuevo en supabase/migrations/ con RLS y policies; nunca edites una migración ya commiteada; después `pnpm db:reset && pnpm db:types`.
- UI: mobile-first a 390 px de ancho. Igual al diseño de referencia en estructura, tamaños, espaciados y jerarquía. Colores SOLO con tokens del tema (nunca hex). Títulos con `font-display`. Íconos de lucide-react. Áreas táctiles de 44 px o más. Textos en español con voseo. Estados de carga, vacío y error.
- Reutilizá los componentes existentes de components/ antes de crear nuevos.
- Copiá los patrones de la sección 6 de docs/execution/02-codigo-deepseek.md (si el código existente difiere, gana el código existente).
- Nunca escribas claves ni uses el cliente admin si la tarea no lo pide.

PASO 4 — VERIFICAR
- Corré la "Verificación" de la tarea y `pnpm check`. Si tocaste la base, también `pnpm db:test`.
- Si algo falla, arreglalo. Nunca borres ni debilites un test. Si falla 3 veces por la misma causa, frená y explicá.
- Revisá uno por uno los criterios de "Aceptación" y decí si se cumplen.

PASO 5 — CERRAR
- Marcá [x] la tarea T1.4 en docs/plan/etapa-01-auth-grupos.md y en el tablero de docs/plan/README.md.
- Si tomaste decisiones que no estaban en el plan, anotalas en "Notas de ejecución" de docs/plan/etapa-01-auth-grupos.md.
- Commit: `git add -A && git commit -m "T1.4: <resumen corto en inglés>"` y `git push`.

RESPUESTA FINAL (en español):
1. Qué hiciste (archivos).
2. Cada criterio de aceptación: cumplido / no cumplido.
3. Resultado de las pruebas.
4. Cómo lo pruebo a mano (URL y pasos).
5. Decisiones o dudas para la revisión.
```

## 6 · DeepSeek — T1.5: Administrar grupos

```text
Vas a implementar UNA tarea de un proyecto Next.js + Supabase. Trabajás en ~/projects/recetario, en la rama etapa-01.

TAREA: T1.5 — Administrar grupos
ARCHIVO DE LA ETAPA: docs/plan/etapa-01-auth-grupos.md
DISEÑO DE REFERENCIA: docs/design/pantallas/Perfil.html (lista de grupos)

PASO 0 — RAMA
Corré `git checkout etapa-01 && git pull` y `git status`. Si hay cambios sin commitear que no son tuyos, frená y avisame.

PASO 1 — LEER (no escribas código todavía)
a) CLAUDE.md completo.
b) docs/execution/02-codigo-deepseek.md, secciones 2 y 6.
c) En docs/plan/etapa-01-auth-grupos.md: la tarea T1.5 completa y las tareas que figuran en su "Depende de".
d) Las secciones de docs/SPEC.md que la tarea cita en "Spec".
e) docs/design/README.md (secciones 1, 2 y 3) y el diseño de referencia indicado arriba.
f) Los archivos que ya existen y vas a modificar o usar. Corré `git log --oneline -15` para ver qué se hizo antes.

PASO 2 — PLAN
Escribí un plan corto:
- Lista exacta de archivos a crear y a modificar.
- Para cada criterio de "Aceptación" de la tarea, cómo lo vas a cumplir.
- Dudas: si algo no está definido en el plan ni en el spec, decilo ahora y elegí la opción más simple.

PASO 3 — IMPLEMENTAR
Seguí los "Pasos" de la tarea en orden. Reglas obligatorias:
- Solo esta tarea. Nada de lo que diga "Fuera de alcance".
- No agregues dependencias que la tarea no nombre.
- Migraciones: archivo nuevo en supabase/migrations/ con RLS y policies; nunca edites una migración ya commiteada; después `pnpm db:reset && pnpm db:types`.
- UI: mobile-first a 390 px de ancho. Igual al diseño de referencia en estructura, tamaños, espaciados y jerarquía. Colores SOLO con tokens del tema (nunca hex). Títulos con `font-display`. Íconos de lucide-react. Áreas táctiles de 44 px o más. Textos en español con voseo. Estados de carga, vacío y error.
- Reutilizá los componentes existentes de components/ antes de crear nuevos.
- Copiá los patrones de la sección 6 de docs/execution/02-codigo-deepseek.md (si el código existente difiere, gana el código existente).
- Nunca escribas claves ni uses el cliente admin si la tarea no lo pide.

PASO 4 — VERIFICAR
- Corré la "Verificación" de la tarea y `pnpm check`. Si tocaste la base, también `pnpm db:test`.
- Si algo falla, arreglalo. Nunca borres ni debilites un test. Si falla 3 veces por la misma causa, frená y explicá.
- Revisá uno por uno los criterios de "Aceptación" y decí si se cumplen.

PASO 5 — CERRAR
- Marcá [x] la tarea T1.5 en docs/plan/etapa-01-auth-grupos.md y en el tablero de docs/plan/README.md.
- Si tomaste decisiones que no estaban en el plan, anotalas en "Notas de ejecución" de docs/plan/etapa-01-auth-grupos.md.
- Commit: `git add -A && git commit -m "T1.5: <resumen corto en inglés>"` y `git push`.

RESPUESTA FINAL (en español):
1. Qué hiciste (archivos).
2. Cada criterio de aceptación: cumplido / no cumplido.
3. Resultado de las pruebas.
4. Cómo lo pruebo a mano (URL y pasos).
5. Decisiones o dudas para la revisión.
```

## 7 · DeepSeek — T1.6: Invitaciones por link

```text
Vas a implementar UNA tarea de un proyecto Next.js + Supabase. Trabajás en ~/projects/recetario, en la rama etapa-01.

TAREA: T1.6 — Invitaciones por link
ARCHIVO DE LA ETAPA: docs/plan/etapa-01-auth-grupos.md
DISEÑO DE REFERENCIA: la sección 3 de docs/design/README.md (unirse por invitación)

PASO 0 — RAMA
Corré `git checkout etapa-01 && git pull` y `git status`. Si hay cambios sin commitear que no son tuyos, frená y avisame.

PASO 1 — LEER (no escribas código todavía)
a) CLAUDE.md completo.
b) docs/execution/02-codigo-deepseek.md, secciones 2 y 6.
c) En docs/plan/etapa-01-auth-grupos.md: la tarea T1.6 completa y las tareas que figuran en su "Depende de".
d) Las secciones de docs/SPEC.md que la tarea cita en "Spec".
e) docs/design/README.md (secciones 1, 2 y 3) y el diseño de referencia indicado arriba.
f) Los archivos que ya existen y vas a modificar o usar. Corré `git log --oneline -15` para ver qué se hizo antes.

PASO 2 — PLAN
Escribí un plan corto:
- Lista exacta de archivos a crear y a modificar.
- Para cada criterio de "Aceptación" de la tarea, cómo lo vas a cumplir.
- Dudas: si algo no está definido en el plan ni en el spec, decilo ahora y elegí la opción más simple.

PASO 3 — IMPLEMENTAR
Seguí los "Pasos" de la tarea en orden. Reglas obligatorias:
- Solo esta tarea. Nada de lo que diga "Fuera de alcance".
- No agregues dependencias que la tarea no nombre.
- Migraciones: archivo nuevo en supabase/migrations/ con RLS y policies; nunca edites una migración ya commiteada; después `pnpm db:reset && pnpm db:types`.
- UI: mobile-first a 390 px de ancho. Igual al diseño de referencia en estructura, tamaños, espaciados y jerarquía. Colores SOLO con tokens del tema (nunca hex). Títulos con `font-display`. Íconos de lucide-react. Áreas táctiles de 44 px o más. Textos en español con voseo. Estados de carga, vacío y error.
- Reutilizá los componentes existentes de components/ antes de crear nuevos.
- Copiá los patrones de la sección 6 de docs/execution/02-codigo-deepseek.md (si el código existente difiere, gana el código existente).
- Nunca escribas claves ni uses el cliente admin si la tarea no lo pide.

PASO 4 — VERIFICAR
- Corré la "Verificación" de la tarea y `pnpm check`. Si tocaste la base, también `pnpm db:test`.
- Si algo falla, arreglalo. Nunca borres ni debilites un test. Si falla 3 veces por la misma causa, frená y explicá.
- Revisá uno por uno los criterios de "Aceptación" y decí si se cumplen.

PASO 5 — CERRAR
- Marcá [x] la tarea T1.6 en docs/plan/etapa-01-auth-grupos.md y en el tablero de docs/plan/README.md.
- Si tomaste decisiones que no estaban en el plan, anotalas en "Notas de ejecución" de docs/plan/etapa-01-auth-grupos.md.
- Commit: `git add -A && git commit -m "T1.6: <resumen corto en inglés>"` y `git push`.

RESPUESTA FINAL (en español):
1. Qué hiciste (archivos).
2. Cada criterio de aceptación: cumplido / no cumplido.
3. Resultado de las pruebas.
4. Cómo lo pruebo a mano (URL y pasos).
5. Decisiones o dudas para la revisión.
```

## 8 · DeepSeek — T1.7: E2E de grupos

```text
Vas a implementar UNA tarea de un proyecto Next.js + Supabase. Trabajás en ~/projects/recetario, en la rama etapa-01.

TAREA: T1.7 — E2E de grupos
ARCHIVO DE LA ETAPA: docs/plan/etapa-01-auth-grupos.md
DISEÑO DE REFERENCIA: ninguno (seguí la sección 3 de docs/design/README.md si la tarea tiene pantallas)

PASO 0 — RAMA
Corré `git checkout etapa-01 && git pull` y `git status`. Si hay cambios sin commitear que no son tuyos, frená y avisame.

PASO 1 — LEER (no escribas código todavía)
a) CLAUDE.md completo.
b) docs/execution/02-codigo-deepseek.md, secciones 2 y 6.
c) En docs/plan/etapa-01-auth-grupos.md: la tarea T1.7 completa y las tareas que figuran en su "Depende de".
d) Las secciones de docs/SPEC.md que la tarea cita en "Spec".
e) docs/design/README.md (secciones 1, 2 y 3) y el diseño de referencia indicado arriba.
f) Los archivos que ya existen y vas a modificar o usar. Corré `git log --oneline -15` para ver qué se hizo antes.

PASO 2 — PLAN
Escribí un plan corto:
- Lista exacta de archivos a crear y a modificar.
- Para cada criterio de "Aceptación" de la tarea, cómo lo vas a cumplir.
- Dudas: si algo no está definido en el plan ni en el spec, decilo ahora y elegí la opción más simple.

PASO 3 — IMPLEMENTAR
Seguí los "Pasos" de la tarea en orden. Reglas obligatorias:
- Solo esta tarea. Nada de lo que diga "Fuera de alcance".
- No agregues dependencias que la tarea no nombre.
- Migraciones: archivo nuevo en supabase/migrations/ con RLS y policies; nunca edites una migración ya commiteada; después `pnpm db:reset && pnpm db:types`.
- UI: mobile-first a 390 px de ancho. Igual al diseño de referencia en estructura, tamaños, espaciados y jerarquía. Colores SOLO con tokens del tema (nunca hex). Títulos con `font-display`. Íconos de lucide-react. Áreas táctiles de 44 px o más. Textos en español con voseo. Estados de carga, vacío y error.
- Reutilizá los componentes existentes de components/ antes de crear nuevos.
- Copiá los patrones de la sección 6 de docs/execution/02-codigo-deepseek.md (si el código existente difiere, gana el código existente).
- Nunca escribas claves ni uses el cliente admin si la tarea no lo pide.

PASO 4 — VERIFICAR
- Corré la "Verificación" de la tarea y `pnpm check`. Si tocaste la base, también `pnpm db:test`.
- Si algo falla, arreglalo. Nunca borres ni debilites un test. Si falla 3 veces por la misma causa, frená y explicá.
- Revisá uno por uno los criterios de "Aceptación" y decí si se cumplen.

PASO 5 — CERRAR
- Marcá [x] la tarea T1.7 en docs/plan/etapa-01-auth-grupos.md y en el tablero de docs/plan/README.md.
- Si tomaste decisiones que no estaban en el plan, anotalas en "Notas de ejecución" de docs/plan/etapa-01-auth-grupos.md.
- Commit: `git add -A && git commit -m "T1.7: <resumen corto en inglés>"` y `git push`.

RESPUESTA FINAL (en español):
1. Qué hiciste (archivos).
2. Cada criterio de aceptación: cumplido / no cumplido.
3. Resultado de las pruebas.
4. Cómo lo pruebo a mano (URL y pasos).
5. Decisiones o dudas para la revisión.
```

## 9 · Sonnet — revisión de la etapa

```text
Sos el revisor técnico del proyecto en ~/projects/recetario (WSL). Revisás la Etapa 01 (rama etapa-01) antes de que entre a main.

Seguí al pie de la letra la sección A de docs/execution/03-revision-sonnet.md, con estos valores:
- Etapa: 01
- Rama: etapa-01
- Archivo de la etapa: docs/plan/etapa-01-auth-grupos.md
- Informe: docs/reviews/etapa-01.md
- Pantallas de diseño: las asignadas a las tareas de esta etapa en docs/execution/prompts/etapa-01.md

Empezá leyendo CLAUDE.md, docs/execution/03-revision-sonnet.md y docs/plan/etapa-01-auth-grupos.md. Después hacé los pasos 1 a 11 en orden.

RESPUESTA FINAL (en español, corta):
- Veredicto: MERGEADA / BLOQUEADA (por qué).
- Pruebas: resultado de cada comando.
- Arreglos que hiciste.
- Tareas fix para DeepSeek (IDs).
- Qué tengo que probar yo en el celular (3 a 6 pasos).
```

## 10 · Si la revisión dejó fixes

**DeepSeek** (repetir una vez por fix):

```text
En docs/reviews/etapa-01.md hay tareas fix pendientes para la rama etapa-01. Trabajás en ~/projects/recetario.

1. `git checkout etapa-01 && git pull`.
2. Leé CLAUDE.md, docs/execution/02-codigo-deepseek.md (secciones 2 y 6) y el informe docs/reviews/etapa-01.md.
3. Resolvé SOLO la primera tarea fix que no esté marcada como resuelta. Leé también la tarea original que menciona.
4. Arreglá solo eso, sin tocar nada más. Agregá o ajustá el test que demuestre el arreglo.
5. Corré `pnpm check` (y `pnpm db:test` si tocaste la base).
6. Marcá el fix como resuelto [x] en el informe, commiteá "<ID-FIX>: <resumen>" y `git push`.
7. Decime qué arreglaste y si quedan más fixes pendientes (si quedan, pegame este mismo prompt de nuevo).
```

**Sonnet** (cuando no queden fixes):

```text
Sos el revisor técnico del proyecto en ~/projects/recetario. En la rama etapa-01 se resolvieron las tareas fix de docs/reviews/etapa-01.md.
Leé el informe, verificá cada fix (código + test) y repetí los pasos 2, 4 y 7 de la revisión de etapa (docs/execution/03-revision-sonnet.md, sección A).
Actualizá el informe y, si todo está en verde, seguí con el paso 10 (PR, CI, merge y deploy) y el 11.
```
