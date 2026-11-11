# Prompts — Etapa 09: Meal prep y tips

Copiá y pegá cada bloque **en orden**, cada uno en una sesión nueva. Plan de la etapa: [`docs/plan/etapa-09-meal-prep.md`](../../plan/etapa-09-meal-prep.md).

| Paso | Quién | Qué |
|---|---|---|
| 1 | Sonnet (Claude Code) | Configuración puntual + crear rama |
| 2 | DeepSeek | T9.1 — Jobs en segundo plano (Inngest) |
| 3 | DeepSeek | T9.2 — Generar tareas de meal prep |
| 4 | DeepSeek | T9.3 — UI de preparaciones |
| 5 | DeepSeek | T9.4 — Variedad y conservación |
| 6 | Sonnet (Claude Code) | Revisión de la etapa y merge |
| 7 | DeepSeek → Sonnet | Solo si la revisión dejó fixes |

---

## 1 · Sonnet — configuración puntual

```text
Sos el responsable de configuración del proyecto en ~/projects/recetario (WSL).

Leé CLAUDE.md, docs/execution/README.md, docs/execution/01-configuracion-sonnet.md (sección C) y docs/plan/etapa-09-meal-prep.md.

Hacé solo la configuración puntual de esta etapa (cuenta de Inngest e integración con Vercel), según la tabla de la sección C de docs/execution/01-configuracion-sonnet.md. No escribas código de la etapa: eso lo hace otro agente.

Reglas:
- Los pasos en consolas web los hago yo: guiame paso a paso y esperá mi confirmación.
- Nunca me pidas claves en el chat. Decime en qué archivo o panel van (.env.local, Vercel, secrets de GitHub, supabase/config.toml).
- Lo que se pueda dejar en el repo (config.toml, .env.example, docs/deploy.md) dejalo commiteado en main con el mensaje "config(etapa-09): <resumen>".
- Creá la rama etapa-09 desde main y subila: `git checkout main && git pull && git checkout -b etapa-09 && git push -u origin etapa-09`.
- Al final, verificá que la configuración funciona y decime qué quedó listo.
```

## 2 · DeepSeek — T9.1: Jobs en segundo plano (Inngest)

```text
Vas a implementar UNA tarea de un proyecto Next.js + Supabase. Trabajás en ~/projects/recetario, en la rama etapa-09.

TAREA: T9.1 — Jobs en segundo plano (Inngest)
ARCHIVO DE LA ETAPA: docs/plan/etapa-09-meal-prep.md
DISEÑO DE REFERENCIA: ninguno (seguí la sección 3 de docs/design/README.md si la tarea tiene pantallas)

NOTA IMPORTANTE: La cuenta de Inngest y sus variables ya están configuradas: no hagas los pasos 👤.

PASO 0 — RAMA
Corré `git checkout etapa-09 && git pull` y `git status`. Si hay cambios sin commitear que no son tuyos, frená y avisame.

PASO 1 — LEER (no escribas código todavía)
a) CLAUDE.md completo.
b) docs/execution/02-codigo-deepseek.md, secciones 2 y 6.
c) En docs/plan/etapa-09-meal-prep.md: la tarea T9.1 completa y las tareas que figuran en su "Depende de".
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
- Marcá [x] la tarea T9.1 en docs/plan/etapa-09-meal-prep.md y en el tablero de docs/plan/README.md.
- Si tomaste decisiones que no estaban en el plan, anotalas en "Notas de ejecución" de docs/plan/etapa-09-meal-prep.md.
- Commit: `git add -A && git commit -m "T9.1: <resumen corto en inglés>"` y `git push`.

RESPUESTA FINAL (en español):
1. Qué hiciste (archivos).
2. Cada criterio de aceptación: cumplido / no cumplido.
3. Resultado de las pruebas.
4. Cómo lo pruebo a mano (URL y pasos).
5. Decisiones o dudas para la revisión.
```

## 3 · DeepSeek — T9.2: Generar tareas de meal prep

```text
Vas a implementar UNA tarea de un proyecto Next.js + Supabase. Trabajás en ~/projects/recetario, en la rama etapa-09.

TAREA: T9.2 — Generar tareas de meal prep
ARCHIVO DE LA ETAPA: docs/plan/etapa-09-meal-prep.md
DISEÑO DE REFERENCIA: ninguno (seguí la sección 3 de docs/design/README.md si la tarea tiene pantallas)

PASO 0 — RAMA
Corré `git checkout etapa-09 && git pull` y `git status`. Si hay cambios sin commitear que no son tuyos, frená y avisame.

PASO 1 — LEER (no escribas código todavía)
a) CLAUDE.md completo.
b) docs/execution/02-codigo-deepseek.md, secciones 2 y 6.
c) En docs/plan/etapa-09-meal-prep.md: la tarea T9.2 completa y las tareas que figuran en su "Depende de".
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
- Marcá [x] la tarea T9.2 en docs/plan/etapa-09-meal-prep.md y en el tablero de docs/plan/README.md.
- Si tomaste decisiones que no estaban en el plan, anotalas en "Notas de ejecución" de docs/plan/etapa-09-meal-prep.md.
- Commit: `git add -A && git commit -m "T9.2: <resumen corto en inglés>"` y `git push`.

RESPUESTA FINAL (en español):
1. Qué hiciste (archivos).
2. Cada criterio de aceptación: cumplido / no cumplido.
3. Resultado de las pruebas.
4. Cómo lo pruebo a mano (URL y pasos).
5. Decisiones o dudas para la revisión.
```

## 4 · DeepSeek — T9.3: UI de preparaciones

```text
Vas a implementar UNA tarea de un proyecto Next.js + Supabase. Trabajás en ~/projects/recetario, en la rama etapa-09.

TAREA: T9.3 — UI de preparaciones
ARCHIVO DE LA ETAPA: docs/plan/etapa-09-meal-prep.md
DISEÑO DE REFERENCIA: docs/design/pantallas/Mediodia.html (agenda del día)

PASO 0 — RAMA
Corré `git checkout etapa-09 && git pull` y `git status`. Si hay cambios sin commitear que no son tuyos, frená y avisame.

PASO 1 — LEER (no escribas código todavía)
a) CLAUDE.md completo.
b) docs/execution/02-codigo-deepseek.md, secciones 2 y 6.
c) En docs/plan/etapa-09-meal-prep.md: la tarea T9.3 completa y las tareas que figuran en su "Depende de".
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
- Marcá [x] la tarea T9.3 en docs/plan/etapa-09-meal-prep.md y en el tablero de docs/plan/README.md.
- Si tomaste decisiones que no estaban en el plan, anotalas en "Notas de ejecución" de docs/plan/etapa-09-meal-prep.md.
- Commit: `git add -A && git commit -m "T9.3: <resumen corto en inglés>"` y `git push`.

RESPUESTA FINAL (en español):
1. Qué hiciste (archivos).
2. Cada criterio de aceptación: cumplido / no cumplido.
3. Resultado de las pruebas.
4. Cómo lo pruebo a mano (URL y pasos).
5. Decisiones o dudas para la revisión.
```

## 5 · DeepSeek — T9.4: Variedad y conservación

```text
Vas a implementar UNA tarea de un proyecto Next.js + Supabase. Trabajás en ~/projects/recetario, en la rama etapa-09.

TAREA: T9.4 — Variedad y conservación
ARCHIVO DE LA ETAPA: docs/plan/etapa-09-meal-prep.md
DISEÑO DE REFERENCIA: ninguno (seguí la sección 3 de docs/design/README.md si la tarea tiene pantallas)

PASO 0 — RAMA
Corré `git checkout etapa-09 && git pull` y `git status`. Si hay cambios sin commitear que no son tuyos, frená y avisame.

PASO 1 — LEER (no escribas código todavía)
a) CLAUDE.md completo.
b) docs/execution/02-codigo-deepseek.md, secciones 2 y 6.
c) En docs/plan/etapa-09-meal-prep.md: la tarea T9.4 completa y las tareas que figuran en su "Depende de".
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
- Marcá [x] la tarea T9.4 en docs/plan/etapa-09-meal-prep.md y en el tablero de docs/plan/README.md.
- Si tomaste decisiones que no estaban en el plan, anotalas en "Notas de ejecución" de docs/plan/etapa-09-meal-prep.md.
- Commit: `git add -A && git commit -m "T9.4: <resumen corto en inglés>"` y `git push`.

RESPUESTA FINAL (en español):
1. Qué hiciste (archivos).
2. Cada criterio de aceptación: cumplido / no cumplido.
3. Resultado de las pruebas.
4. Cómo lo pruebo a mano (URL y pasos).
5. Decisiones o dudas para la revisión.
```

## 6 · Sonnet — revisión de la etapa

```text
Sos el revisor técnico del proyecto en ~/projects/recetario (WSL). Revisás la Etapa 09 (rama etapa-09) antes de que entre a main.

Seguí al pie de la letra la sección A de docs/execution/03-revision-sonnet.md, con estos valores:
- Etapa: 09
- Rama: etapa-09
- Archivo de la etapa: docs/plan/etapa-09-meal-prep.md
- Informe: docs/reviews/etapa-09.md
- Pantallas de diseño: las asignadas a las tareas de esta etapa en docs/execution/prompts/etapa-09.md

Empezá leyendo CLAUDE.md, docs/execution/03-revision-sonnet.md y docs/plan/etapa-09-meal-prep.md. Después hacé los pasos 1 a 11 en orden.

RESPUESTA FINAL (en español, corta):
- Veredicto: MERGEADA / BLOQUEADA (por qué).
- Pruebas: resultado de cada comando.
- Arreglos que hiciste.
- Tareas fix para DeepSeek (IDs).
- Qué tengo que probar yo en el celular (3 a 6 pasos).
```

## 7 · Si la revisión dejó fixes

**DeepSeek** (repetir una vez por fix):

```text
En docs/reviews/etapa-09.md hay tareas fix pendientes para la rama etapa-09. Trabajás en ~/projects/recetario.

1. `git checkout etapa-09 && git pull`.
2. Leé CLAUDE.md, docs/execution/02-codigo-deepseek.md (secciones 2 y 6) y el informe docs/reviews/etapa-09.md.
3. Resolvé SOLO la primera tarea fix que no esté marcada como resuelta. Leé también la tarea original que menciona.
4. Arreglá solo eso, sin tocar nada más. Agregá o ajustá el test que demuestre el arreglo.
5. Corré `pnpm check` (y `pnpm db:test` si tocaste la base).
6. Marcá el fix como resuelto [x] en el informe, commiteá "<ID-FIX>: <resumen>" y `git push`.
7. Decime qué arreglaste y si quedan más fixes pendientes (si quedan, pegame este mismo prompt de nuevo).
```

**Sonnet** (cuando no queden fixes):

```text
Sos el revisor técnico del proyecto en ~/projects/recetario. En la rama etapa-09 se resolvieron las tareas fix de docs/reviews/etapa-09.md.
Leé el informe, verificá cada fix (código + test) y repetí los pasos 2, 4 y 7 de la revisión de etapa (docs/execution/03-revision-sonnet.md, sección A).
Actualizá el informe y, si todo está en verde, seguí con el paso 10 (PR, CI, merge y deploy) y el 11.
```
