# Etapa 7 — Plan semanal

**Resultado:** armamos la semana a mano o charlando con la IA, que respeta las restricciones de cada uno, varía las comidas y tiene en cuenta qué se pone feo antes; aprobamos el plan y la home "Hoy" nos dice qué comer y cocinar, o, si no hay nada planeado, nos ayuda a decidir en un minuto.
**Spec:** §3 F6, F6b, F15 · §5.2 (Planificación) · §6.4, §6.8 · §8.1 · §12 (momentos del día).

Parte **7a** (manual, T7.1–T7.6), parte **7b** (IA, T7.7–T7.11) y parte **7c** (arranques sin plan, T7.12–T7.14). La 7a sola ya es usable.

---

## 7a — Plan manual

### [x] T7.1 — Migración: planes
- **Depende de:** T2.1
- **Archivos:** `supabase/migrations/<ts>_meal_plans.sql`, `supabase/tests/07_plans.test.sql`.
- **Pasos:**
  1. Tablas `meal_plans`, `meal_plan_entries`, `prep_tasks` (§5.2). `unique (group_id, week_start)` para planes no archivados (índice parcial).
  2. `meal_plan_entries.slot` validado contra `groups.meal_slots` (trigger) — valores: `breakfast`, `lunch`, `merienda`, `dinner`, `snack`.
  3. RLS por grupo. Agregar `meal_plan_entries` y `meal_plans` a la publicación `supabase_realtime`.
  4. RPCs: `approve_plan(p_plan_id)` (pasa a `approved`, promueve recetas `draft` usadas en el plan a `active` y borra las `draft` que quedaron fuera; graba `approved_by/at`), `duplicate_plan(p_plan_id, p_week_start)`.
- **Aceptación:** pgTAP de RLS y de `approve_plan` con recetas draft.

### [x] T7.2 — Dominio: semanas y momentos
- **Archivos:** `lib/domain/week.ts` + test, `lib/domain/meal-slots.ts`.
- **Pasos:** `weekStartOf(date, weekStartsOn)`, `weekDays(weekStart)`, `formatWeekLabel` ("Semana del 17 al 23 de noviembre"), zona horaria `America/Argentina/Buenos_Aires`. `MEAL_SLOTS` con etiqueta y orden: Desayuno, Almuerzo, Merienda, Cena, Snacks.

### [x] T7.3 — Pantalla del plan (grilla)
- **Depende de:** T7.1, T7.2
- **Archivos:** `app/(app)/g/[groupId]/plan/page.tsx` (redirige a la semana actual), `.../plan/[weekStart]/page.tsx`, `components/plan/*`, `lib/plan/{queries,actions}.ts`.
- **Pasos:**
  1. Header: "◀ Semana del 17 al 23 ▶", estado (Borrador / Aprobado), menú (Duplicar semana anterior, Historial).
  2. Mobile: lista vertical de días (hoy primero si es la semana actual); cada día muestra sus momentos; **momentos vacíos colapsados** en una fila "+ Agregar desayuno · merienda · snack".
  3. Celda con receta: foto miniatura, título, porciones, avatares de comensales, chips "sobras" / "se cocina el domingo".
  4. Agregar: sheet con buscador de recetas del grupo (con indicadores de compatibilidad y filtro "aptas para los que comen"), favoritas y recientes primero; o texto libre ("Comemos afuera", "Pedimos").
  5. Editar entrada: porciones, quiénes comen (default: todos los miembros), "es sobra de…" (lista de entradas anteriores de la semana), "se cocina el…" (fecha), notas, quitar.
  6. Si no hay plan para la semana: estado vacío con "Armar a mano" / "Armar con IA" (deshabilitado hasta T7.9) / "Repetir una semana anterior".
- **Aceptación:** armar una semana de almuerzos y cenas a mano en < 5 minutos.

### [x] T7.4 — Aprobar, historial y duplicar
- **Depende de:** T7.3
- **Pasos:**
  1. Botón fijo "Aprobar plan" → `approve_plan` → toast. (La lista de compras se engancha en la Etapa 8.)
  2. Plan aprobado: se puede seguir editando; un banner avisa "Cambiaste el plan aprobado" (en la Etapa 8 ofrecerá actualizar la lista).
  3. Historial: lista de semanas anteriores con miniaturas; abrir una en solo lectura; "Repetir esta semana" → `duplicate_plan` a la semana elegida.
- **Aceptación:** duplicar mantiene recetas, momentos, comensales y sobras (con fechas corridas).

### [x] T7.5 — Home "Hoy" con estados
- **Depende de:** T7.3, T0.2 (temas por momento del día)
- **Spec:** §3 F6b · §8.1 · canvas de diseño (pantallas "Inicio · Mediodía · con plan", "Inicio · Tarde · sin plan", "Inicio · Noche · con plan").
- **Archivos:** `app/(app)/g/[groupId]/hoy/page.tsx`, `components/today/*`, `lib/domain/today.ts` + test.
- **Pasos:**
  1. `lib/domain/today.ts`: `resolveToday({ now, entries, prepTasks, dayPart })` → `{ state: "planned" | "unplanned" | "done_for_today", nextMeal, agenda[], tomorrow }`. La próxima comida se elige por hora (antes de las 15 h almuerzo; después, cena; si ya se cocinó, la siguiente). Tests para cada estado y borde horario.
  2. **Estado `planned`:** `Hero` con la próxima comida (ilustración/foto, "AL MEDIODÍA" / "ESTA NOCHE", título serif, "15 min · 5 pasos · ya tenés todo") y botón principal **"Armar el almuerzo" / "Empezar a cocinar"** (abre modo cocinar con `plan_entry_id`); si es sobra, "Calentar". Debajo, **"El resto del día"**: agenda con hora (tareas y la otra comida), y la tarjeta de compras (se completa en la Etapa 8).
  3. **Estado `unplanned`:** `Hero` "¿Qué comemos hoy?" + barra de texto/voz ("Tengo ganas de algo con pollo…") que lleva a ¿Qué tenés? (T7.12) con el texto precargado; y tres tarjetas: **1 · Elegí** → Ideas para hoy (T7.13), **2 · Contame** → ¿Qué tenés? (T7.12), **3 · Planificá** → plan con IA (T7.9). Hasta que existan esas tareas, las tarjetas 1 y 2 quedan ocultas.
  4. **Estado `done_for_today`:** "Mañana" con vista previa + recordatorios para esta noche.
  5. Avisos derivados del plan: "Mañana hay pescado: pasalo del freezer a la heladera hoy a la noche" (si la receta tiene `storage_info` o el ingrediente es congelado).
  6. Lugar reservado para tareas de meal prep (Etapa 9).
- **Aceptación:** abrir la app a la noche con cena planeada muestra la cena y "Empezar a cocinar" sin scroll; sin plan, muestra los arranques; el tono cambia según la hora.

### [x] T7.6 — Tiempo real en el plan
- **Depende de:** T7.3
- **Archivos:** `lib/hooks/use-realtime-plan.ts`.
- **Pasos:** suscripción a cambios de `meal_plan_entries` del plan abierto; aplicar cambios al estado local; indicador "Sofi está editando" con Presence.
- **Aceptación:** dos celulares ven los cambios del otro en < 2 s.

## 7b — Plan con IA

### [x] T7.7 — Dominio: `validatePlan` 🧠
- **Depende de:** T6.5, T7.2
- **Archivos:** `lib/domain/validate-plan.ts` + test, `lib/domain/perishability.ts` + test.
- **Pasos:**
  1. Input: entradas del plan con recetas (ingredientes con familias, nutrición aproximada, vida útil del catálogo), dietas de los comensales, fecha de compra prevista (default: `week_start` o el día anterior).
  2. Salida `{ errors[], warnings[] }`, cada uno con `entryId`, `code` y `message` en español para el modelo y para la UI:
     - `FORBIDDEN_INGREDIENT` (error): usa `checkRecipe` con los comensales de **esa** entrada.
     - `LIMIT_EXCEEDED` (warning): objetivos numéricos (ej. carbohidratos/día estimados con `nutrition_per_100g`), solo si hay datos.
     - `REPEATED_RECIPE` (warning): misma receta > 1 vez sin ser sobra.
     - `PROTEIN_MONOTONY` (warning): misma familia de proteína (`ave`, `carne_roja`, `pescado`, `cerdo`, `huevo`, `legumbre`) > 3 veces en la semana.
     - `PERISHABLE_LATE` (warning): ingrediente cuya vida útil máxima en heladera es menor que los días entre la compra y su uso → sugerencia "movelo antes o compralo a mitad de semana".
     - `LEFTOVERS_EXPIRED` (warning): sobras usadas más de 3 días después de cocinar.
  3. Tests para cada código.
- **Aceptación:** tests en verde; función pura sin DB.

### [x] T7.8 — Agente del plan (chat con tools) 🧠
- **Depende de:** T7.7, T5.1
- **Archivos:** `app/api/ai/plans/[id]/chat/route.ts`, `lib/ai/plan-agent/{agent,tools,prompt,events}.ts`.
- **Pasos:**
  1. Endpoint con **streaming SSE**. Input: `{ message: string }`. Carga la conversación de `ai_messages` (por `plan_id`).
  2. Tools (§6.4), implementadas en el servidor con el cliente del usuario (respeta RLS):
     - `search_recipes({ query?, tags?, max_minutes?, exclude_ids?, for_user_ids? })` → hasta 20 recetas resumidas con compatibilidad.
     - `get_recent_meals({ weeks })` → lo comido en las últimas N semanas.
     - `get_participants({})` → miembros con dietas (vía `get_group_diet`), horarios y equipamiento.
     - `get_ingredient_info({ names })` → vida útil, sección, familia.
     - `propose_recipe({ recipe: RecipeDraft })` → crea receta `status = 'draft'` y devuelve id.
     - `set_plan({ entries })` y `update_entries({ changes })` → escriben el borrador **y corren `validatePlan`**; si hay `errors`, el `tool_result` va con `is_error: true` y el detalle, y la escritura **no** se aplica.
  3. Loop: llamar al modelo (`MODELS.smart`) → ejecutar tools → repetir hasta respuesta final o 12 iteraciones. Emitir eventos SSE: `text_delta`, `tool_started` (para mostrar "Buscando recetas…"), `plan_updated` (entradas nuevas + warnings), `done`, `error`.
  4. System prompt: objetivos (§3 F6.3), reglas duras (restricciones; priorizar recetario; recetas rápidas en semana; perecederos al principio; aprovechar sobras y batch cooking; ingredientes compartidos), formato de respuesta (corto, en voseo, explicando los cambios en 2–4 líneas).
  5. Persistir mensajes y tool calls en `ai_messages`; registrar cada llamada en `ai_runs`; cuota `plan_chat`.
  6. Tests del loop con el cliente mockeado: tool de escritura rechazada por cebolla → el modelo recibe el error.
- **Aceptación:** con un recetario de prueba de 20 recetas, "armame almuerzos y cenas de lunes a viernes" produce un plan sin errores en < 60 s.

### [x] T7.9 — UI del chat del plan
- **Depende de:** T7.8
- **Archivos:** `components/plan/plan-chat-sheet.tsx`, `lib/hooks/use-plan-chat.ts`.
- **Pasos:**
  1. "Armar con IA" abre un bottom sheet en tres alturas (la grilla queda visible arriba).
  2. Primer mensaje sugerido con chips editables: "Armame la semana", "Solo cenas", "El jueves comemos afuera", "Quiero pescado 2 veces", "Recetas de menos de 30 min". Input de texto + botón de voz (`VoiceRecorder`).
  3. Mensajes con streaming; indicadores de herramientas ("Revisando tus recetas…").
  4. En `plan_updated`, la grilla se actualiza con una animación; las celdas nuevas o cambiadas se resaltan unos segundos; los warnings aparecen como ⚠️ en la celda con su explicación.
  5. Recetas nuevas propuestas por la IA con badge "Nueva" → tocar abre el borrador para revisarlo/editarlo.
- **Aceptación:** pedir "cambiá el miércoles por algo con carne" cambia solo esa celda.

### [x] T7.10 — Recetas nuevas de la IA
- **Depende de:** T7.8
- **Pasos:** `meal_plan_entries.is_new_recipe` y `recipes.status = 'draft'` se muestran claros en el plan; las recetas `draft` no aparecen en el recetario hasta aprobar el plan (filtrar `status = 'active'` en `listRecipes`). Al aprobar, `approve_plan` las activa. Al descartar el borrador del plan, se borran.
- **Aceptación:** una receta inventada por la IA aparece en el recetario solo después de aprobar el plan.

### [x] T7.11 — Evals del plan
- **Archivos:** `tests/evals/plan/*`.
- **Pasos:** recetario de prueba (25 recetas, 6 con cebolla) + 2 perfiles (uno sin cebolla y bajo en carbohidratos). 8 pedidos distintos. Chequeos: 0 errores de `validatePlan`, ≤ 2 warnings de monotonía, ≥ 70% recetas del recetario, ninguna receta repetida sin ser sobra. Imprime costo y tiempo.
- **Aceptación:** 8/8 sin errores.

## 7c — Arranques sin plan

### [x] T7.12 — ¿Qué tenés?
- **Depende de:** T7.5, T6.5, T5.2
- **Spec:** §3 F15 · §6.8 · canvas ("¿Qué tenés?").
- **Archivos:** `app/(app)/g/[groupId]/hoy/que-tenes/page.tsx`, `components/suggest/*`, `lib/domain/coverage.ts` + test, `app/api/ai/suggest/route.ts`, `lib/ai/suggest/*`.
- **Pasos:**
  1. UI: ingredientes como chips (agregar escribiendo, con autocompletado de `search_ingredients`, o por voz con `VoiceRecorder`: la transcripción se separa en ingredientes), antojo opcional, filtros rápidos (Menos de 30 min · Sin horno · Liviano).
  2. `coverage.ts`: dado lo que tengo y una receta → `{ have[], missing[], missingOptional[], score }`. Ignora básicos de alacena (sal, aceite, pimienta).
  3. Endpoint `mode: "have"`: candidatos del recetario por cobertura, filtrados por compatibilidad de los comensales (y por el plan vivo cuando exista, Etapa 8b). Haiku ordena y redacta una línea por resultado. Si hay menos de 2 con cobertura ≥ 70%, propone 1–2 recetas nuevas (`draft`).
  4. Resultados: "Tenés todo · 20 min" o "Te falta: jengibre (opcional)", con botón para cocinar o "Elegir para hoy" (crea la entrada en el plan de hoy, creando el plan de la semana si no existe).
- **Aceptación:** con "pollo, zapallitos, huevos, limón" devuelve al menos 2 opciones aptas para los dos en < 6 s.

### [x] T7.13 — Ideas para hoy
- **Depende de:** T7.12
- **Spec:** §3 F15 · §6.8 · canvas ("Ideas para hoy").
- **Archivos:** `app/(app)/g/[groupId]/hoy/ideas/page.tsx`, `lib/suggest/signals.ts` + test.
- **Pasos:**
  1. `signals.ts`: señales determinísticas por receta: usa perecederos comprados que vencen pronto (lista de compras + vida útil; hasta la Etapa 8 se omite), días desde la última vez que se cocinó, rinde para sobras, tiempo vs. hora actual.
  2. Endpoint `mode: "ideas"` → 3 ideas con **motivo** ("La rúcula vence mañana: aprovechala hoy"). Pestañas: Con lo que compraste · Recetario · Nuevas. "Otras 3 ideas" excluye las ya mostradas.
  3. "Elegir para hoy" igual que T7.12; la home pasa a `planned`.
- **Aceptación:** las 3 ideas son aptas para todos los comensales y cada una explica por qué aparece.

### [x] T7.14 — E2E de la home
- **Archivos:** `tests/e2e/today.spec.ts`.
- **Escenario:** con `page.clock` a las 12:40 y almuerzo planeado → hero de almuerzo y tema `mediodia`; a las 18:10 sin cena → arranques y tema `tarde`; elegir una idea → la home muestra la cena y "Empezar a cocinar"; a las 21:00 → tema `noche`.

---

## Cierre de la Etapa 7
- [ ] Prueba real: planificar una semana con la IA entre los dos.
- [ ] Revisar costo promedio por plan en `ai_runs`.

## Notas de ejecución

- T7.1: tablas `meal_plans` (índice único parcial por grupo y semana, sin contar archivados), `meal_plan_entries` (`slot` validado contra `groups.meal_slots` con trigger; exige receta o texto libre; `replica identity full` para que el realtime traiga la fila borrada) y `prep_tasks`; RLS por grupo a través del plan (`plan_group_id`); `meal_plans` y `meal_plan_entries` agregadas a `supabase_realtime`. Se agregó `recipes.draft_for_plan_id` (no estaba en el plan): ata cada receta que propone la IA al plan que la pidió, para que `approve_plan` active las usadas y borre **solo** las que ese plan propuso y quedaron fuera (sin tocar otros borradores). `duplicate_plan` corre fechas y `cook_date` y reenlaza las sobras a la entrada nueva equivalente. 13 tests pgTAP.

- T7.3: Plan board keyed by plan id so router.refresh remounts it; 'Armar con IA' stays disabled until T7.9; history link target /plan/historial is built in T7.4.

- T7.4: Historial repite en la próxima semana libre; el banner de plan aprobado ya existía desde T7.3.

- T7.5: Cards 1/2 (Ideas, ¿Qué tenés?) hidden until T7.12/T7.13; storage warnings (paso 5) and prep tasks slot arrive with Etapa 9; 'cocinado' not tracked yet so doneIds is empty; cook link passes ?entry=<id> (not consumed yet).

- T7.6: Realtime requires realtime.setAuth(access_token) before subscribing (otherwise RLS filters all changes). Entries are re-read through a server action after a debounced change instead of merging payloads (recipes join is not in the payload).

- T7.7: Familias de proteína (ave, pescado, huevo) dependen del catálogo; si faltan, PROTEIN_MONOTONY no dispara. LIMIT_EXCEEDED solo evalúa un tope diario único de carbohidratos con datos completos.

- T7.8: Plan agent writes go through validateCandidates; errors return is_error and nothing is saved. propose_recipe saves via saveRecipe then marks status=draft + draft_for_plan_id. Real-model behaviour (20-recipe acceptance) is checked in the plan evals (T7.11); not run against the API yet.

- T7.9: Chat is a non-modal fixed bottom panel with three heights (grid stays visible); voice via VoiceRecorder; PlanBoard syncs state from server props with derived-state pattern (lint forbids setState in effect). E2E mocks the SSE endpoint.

- T7.10: Listados (búsqueda, tags, menciones, Apta para) filtran status=active; discardPlan borra el plan y solo los borradores atados a él.

- T7.11: `pnpm eval:plan` (8 pedidos, IA real + DB local, no corre en CI): 8/8 sin errores, ~US$ 0.83 en total (≈ US$ 0.10 por plan, 15–40 s). Se refactorizó `saveRecipeWith`/`loadIngredientsForCheck`/`getPlanEntries` para aceptar un cliente de Supabase y poder correr fuera de Next.

- T7.12: 'Elegir para hoy' crea el plan de la semana si falta y activa la receta si era borrador. La cuota usa la feature 'ideas'. Falta filtrar por el plan vivo (Etapa 8b). Eval: pnpm eval:suggest (5 opciones en 5.5 s).

- T7.13: Pestaña 'Con lo que compraste' queda como mensaje hasta la Etapa 8 (lista de compras). Las ideas del recetario no usan IA (señales por código); 'Nuevas' sí (borradores).

- T7.14: El servidor lee la cookie e2e-now solo si E2E_TIME_OVERRIDE=1 (definida únicamente por playwright.config); también la usa el tema del layout.
