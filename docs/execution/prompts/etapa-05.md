# Etapa 05 — IA: importar recetas y voz

Plan: [`docs/plan/etapa-05-ia-importar.md`](../../plan/etapa-05-ia-importar.md). Tres prompts, en orden, cada uno en una sesión nueva.

| # | Quién | Qué |
|---|---|---|
| 1 | Sonnet | Configuración (API key de Anthropic y proveedor de transcripción, incluida la prueba de calidad del paso 6 de T5.2) + crear la rama etapa-05 |
| 2 | DeepSeek | Código: T5.1, T5.2, T5.3, T5.4, T5.5, T5.6 (todas en una sesión; si se corta, volvés a pegar el mismo prompt) |
| 3 | Sonnet | Revisión, arreglos, merge a main y deploy. Si deja fixes: volvés al prompt 2 y después al 3 |

## 1 · Sonnet — configuración

```text
Sos el responsable de configuración del proyecto en ~/projects/recetario (WSL). Preparás la Etapa 05 para que otro agente escriba el código.

Leé CLAUDE.md, docs/execution/README.md, docs/execution/01-configuracion-sonnet.md (sección C) y docs/plan/etapa-05-ia-importar.md.

1. Hacé la configuración puntual de esta etapa: API key de Anthropic y proveedor de transcripción, incluida la prueba de calidad del paso 6 de T5.2. Seguí la fila de la Etapa 5 en la tabla de la sección C de docs/execution/01-configuracion-sonnet.md, incluida su prueba de que funciona.
2. Lo que se pueda dejar en el repo (supabase/config.toml, .env.example, docs/deploy.md) commitealo en main: "config(etapa-05): <resumen>".
3. Creá la rama de la etapa: `git checkout main && git pull && git checkout -b etapa-05 && git push -u origin etapa-05`.

Reglas:
- No escribas código de la etapa.
- Los pasos en consolas web los hago yo: guiame paso a paso y esperá mi confirmación.
- Nunca me pidas claves en el chat: decime en qué archivo o panel van (.env.local, Vercel, secrets de GitHub).

Al final decime qué quedó listo y que ya puedo pasar al prompt de código.
```

## 2 · DeepSeek — código

```text
Vas a implementar el código de la Etapa 05 de un proyecto Next.js + Supabase. Trabajás en ~/projects/recetario, en la rama etapa-05.

TAREAS, EN ESTE ORDEN (archivo: docs/plan/etapa-05-ia-importar.md):
1. T5.1 — Infraestructura de IA  [ojo: la API key de Anthropic ya está en .env.local; nunca la imprimas ni la escribas en archivos]
2. T5.2 — Voz: grabar y transcribir  [ojo: el proveedor de transcripción ya está elegido (ver Notas de ejecución); NO hagas el paso 6]
3. T5.3 — Importar desde URL
4. T5.4 — Endpoint de parseo de recetas
5. T5.5 — UI de importación  [diseño: docs/design/pantallas/QueTenes.html (inputs y micrófono)]
6. T5.6 — Evals de parseo  [ojo: los evals llaman a la API real: corrélos una sola vez al final]

ANTES DE EMPEZAR
- `git checkout etapa-05 && git pull`, `pnpm db:start` (si no está levantada) y `git status`.
- Si existe docs/reviews/etapa-05.md con tareas fix sin resolver ([ ]), hacé PRIMERO esas fixes (una por una, con su test, commit "<ID-FIX>: <resumen>") y después seguí con las tareas pendientes.
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
Sos el revisor técnico del proyecto en ~/projects/recetario (WSL). Revisás la Etapa 05 (rama etapa-05) antes de que entre a main.

Seguí la sección A de docs/execution/03-revision-sonnet.md (pasos 1 a 11) con estos valores:
- Archivo de la etapa: docs/plan/etapa-05-ia-importar.md
- Informe: docs/reviews/etapa-05.md
- Pantallas de diseño a comparar: docs/design/pantallas/QueTenes.html

Empezá leyendo CLAUDE.md, docs/execution/03-revision-sonnet.md, docs/plan/etapa-05-ia-importar.md y `git log main..etapa-05 --oneline`.

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
