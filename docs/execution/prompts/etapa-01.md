# Etapa 01 — Auth y grupos

Plan: [`docs/plan/etapa-01-auth-grupos.md`](../../plan/etapa-01-auth-grupos.md). Tres prompts, en orden, cada uno en una sesión nueva.

| # | Quién | Qué |
|---|---|---|
| 1 | Sonnet | Configuración (Google OAuth (login con Google) en Google Cloud y Supabase, local y producción) + crear la rama etapa-01 |
| 2 | DeepSeek | Código: T1.1, T1.2, T1.3, T1.4, T1.5, T1.6, T1.7 (todas en una sesión; si se corta, volvés a pegar el mismo prompt) |
| 3 | Sonnet | Revisión, arreglos, merge a main y deploy. Si deja fixes: volvés al prompt 2 y después al 3 |

## 1 · Sonnet — configuración

```text
Sos el responsable de configuración del proyecto en ~/projects/recetario (WSL). Preparás la Etapa 01 para que otro agente escriba el código.

Leé CLAUDE.md, docs/execution/README.md, docs/execution/01-configuracion-sonnet.md (sección C) y docs/plan/etapa-01-auth-grupos.md.

1. Hacé la configuración puntual de esta etapa: Google OAuth (login con Google) en Google Cloud y Supabase, local y producción. Seguí la fila de la Etapa 1 en la tabla de la sección C de docs/execution/01-configuracion-sonnet.md, incluida su prueba de que funciona.
2. Lo que se pueda dejar en el repo (supabase/config.toml, .env.example, docs/deploy.md) commitealo en main: "config(etapa-01): <resumen>".
3. Creá la rama de la etapa: `git checkout main && git pull && git checkout -b etapa-01 && git push -u origin etapa-01`.

Reglas:
- No escribas código de la etapa.
- Los pasos en consolas web los hago yo: guiame paso a paso y esperá mi confirmación.
- Nunca me pidas claves en el chat: decime en qué archivo o panel van (.env.local, Vercel, secrets de GitHub).

Al final decime qué quedó listo y que ya puedo pasar al prompt de código.
```

## 2 · DeepSeek — código

```text
Vas a implementar el código de la Etapa 01 de un proyecto Next.js + Supabase. Trabajás en ~/projects/recetario, en la rama etapa-01.

TAREAS, EN ESTE ORDEN (archivo: docs/plan/etapa-01-auth-grupos.md):
1. T1.1 — Migración: perfiles, grupos, miembros, invitaciones
2. T1.2 — Tests de RLS (pgTAP)
3. T1.3 — Login (Google + magic link)  [diseño: docs/design/pantallas/Perfil.html (cabecera) + docs/design/README.md §3 (login) · ojo: los pasos 👤 de Google OAuth ya los hizo la configuración: solo código]
4. T1.4 — Grupo activo y selector
5. T1.5 — Administrar grupos  [diseño: docs/design/pantallas/Perfil.html (lista de grupos)]
6. T1.6 — Invitaciones por link  [diseño: docs/design/README.md §3 (unirse por invitación)]
7. T1.7 — E2E de grupos

ANTES DE EMPEZAR
- `git checkout etapa-01 && git pull`, `pnpm db:start` (si no está levantada) y `git status`.
- Si existe docs/reviews/etapa-01.md con tareas fix sin resolver ([ ]), hacé PRIMERO esas fixes (una por una, con su test, commit "<ID-FIX>: <resumen>") y después seguí con las tareas pendientes.
- Leé una sola vez: CLAUDE.md, docs/execution/02-codigo-deepseek.md (secciones 2 y 6) y docs/design/README.md.
- Retomá desde la primera tarea de la lista que NO esté marcada [x] en el archivo de la etapa.

PARA CADA TAREA (una por vez, sin mezclar)
1. Leer: la tarea completa en el archivo de la etapa, las que figuran en su "Depende de", las secciones de docs/SPEC.md que cita y el diseño indicado entre corchetes (si no hay, docs/design/README.md §3).
2. Plan: escribí en 3 a 6 líneas qué archivos vas a crear o modificar y cómo cumplís cada criterio de "Aceptación".
3. Implementar siguiendo los "Pasos" de la tarea:
   - Solo esa tarea. Nada de "Fuera de alcance". Sin dependencias que la tarea no nombre.
   - Migraciones nuevas (nunca editar una commiteada), con RLS y policies; después `pnpm db:reset && pnpm db:types`.
   - UI mobile-first a 390 px, igual al diseño en estructura, tamaños y espaciados. Colores SOLO con tokens del tema (nunca hex), títulos con `font-display`, íconos de lucide-react, áreas táctiles ≥ 44 px, textos en español con voseo, estados de carga, vacío y error.
   - Reutilizá componentes existentes y copiá los patrones de 02-codigo-deepseek.md §6.
   - Nunca escribas claves ni uses el cliente admin si la tarea no lo pide.
4. Verificar: la "Verificación" de la tarea y `pnpm check` (y `pnpm db:test` si tocaste la base). Nunca borres ni debilites un test.
5. Cerrar: marcá [x] la tarea en su archivo de etapa y en el tablero de docs/plan/README.md, anotá decisiones en "Notas de ejecución", y `git add -A && git commit -m "<ID>: <resumen en inglés>" && git push`.
6. Escribí una línea de avance ("✅ <ID> lista: …") y pasá a la siguiente.

CUÁNDO FRENAR
- Si una tarea falla 3 veces por la misma causa (o 2 si dice "tarea difícil"): dejá el código como esté, anotá el problema en "Notas de ejecución", NO la marques [x], commiteá "<ID>: WIP - <problema>" y seguí con la siguiente tarea que no dependa de ella.
- Si algo no está definido en el plan ni en el spec y no hay una opción simple obvia: anotalo y elegí la más simple.
- Si te quedás sin contexto o la sesión se corta: me pedís que vuelva a pegar este mismo prompt; vas a retomar desde la primera tarea sin [x].

AL TERMINAR TODAS
Corré `pnpm check`, `pnpm db:test` y `pnpm test:e2e`, hacé `git push` y respondeme en español:
1. Tareas completas y tareas que quedaron WIP (con el motivo).
2. Resultado de las pruebas.
3. Decisiones tomadas fuera del plan.
4. Que ya puedo pasar al prompt de revisión.
```

## 3 · Sonnet — revisión

```text
Sos el revisor técnico del proyecto en ~/projects/recetario (WSL). Revisás la Etapa 01 (rama etapa-01) antes de que entre a main.

Seguí la sección A de docs/execution/03-revision-sonnet.md (pasos 1 a 11) con estos valores:
- Archivo de la etapa: docs/plan/etapa-01-auth-grupos.md
- Informe: docs/reviews/etapa-01.md
- Pantallas de diseño a comparar: docs/design/pantallas/Perfil.html

Empezá leyendo CLAUDE.md, docs/execution/03-revision-sonnet.md, docs/plan/etapa-01-auth-grupos.md y `git log main..etapa-01 --oneline`.

Importante:
- Tareas marcadas WIP o sin [x]: si son chicas, terminalas vos; si son grandes (o son tareas difíciles de lógica/IA que DeepSeek no pudo), resolvelas vos también si te alcanza esta sesión; si no, dejalas como fix en el informe.
- Si dejás fixes para DeepSeek, no mergees: el mismo prompt de código de esta etapa los resuelve primero. Después volvés a correr ESTE prompt y revisás solo lo nuevo.
- Si es una segunda pasada (ya existe el informe), verificá los fixes, repetí los pasos 2, 4 y 7, actualizá el informe y seguí al paso 10.

RESPUESTA FINAL (en español, corta):
- Veredicto: MERGEADA / BLOQUEADA (por qué).
- Pruebas: resultado de cada comando.
- Arreglos que hiciste.
- Fixes para DeepSeek (IDs), si hay.
- Qué tengo que probar yo en el celular (3 a 6 pasos).
```
