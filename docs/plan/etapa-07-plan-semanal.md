# Etapa 7 — Plan semanal

**Resultado:** armamos la semana a mano o charlando con la IA, que respeta las restricciones de cada uno, varía las comidas y tiene en cuenta qué se pone feo antes; aprobamos el plan y la vista "Hoy" nos dice qué comer y cocinar.
**Spec:** §3 F6 · §5.2 (Planificación) · §6.4 · §12 (momentos del día).

Parte **7a** (manual, T7.1–T7.6) y parte **7b** (IA, T7.7–T7.11). La 7a sola ya es usable.

---

## 7a — Plan manual

### T7.1 — Migración: planes
- **Depende de:** T2.1
- **Archivos:** `supabase/migrations/<ts>_meal_plans.sql`, `supabase/tests/07_plans.test.sql`.
- **Pasos:**
  1. Tablas `meal_plans`, `meal_plan_entries`, `prep_tasks` (§5.2). `unique (group_id, week_start)` para planes no archivados (índice parcial).
  2. `meal_plan_entries.slot` validado contra `groups.meal_slots` (trigger) — valores: `breakfast`, `lunch`, `merienda`, `dinner`, `snack`.
  3. RLS por grupo. Agregar `meal_plan_entries` y `meal_plans` a la publicación `supabase_realtime`.
  4. RPCs: `approve_plan(p_plan_id)` (pasa a `approved`, promueve recetas `draft` usadas en el plan a `active` y borra las `draft` que quedaron fuera; graba `approved_by/at`), `duplicate_plan(p_plan_id, p_week_start)`.
- **Aceptación:** pgTAP de RLS y de `approve_plan` con recetas draft.

### T7.2 — Dominio: semanas y momentos
- **Archivos:** `lib/domain/week.ts` + test, `lib/domain/meal-slots.ts`.
- **Pasos:** `weekStartOf(date, weekStartsOn)`, `weekDays(weekStart)`, `formatWeekLabel` ("Semana del 17 al 23 de noviembre"), zona horaria `America/Argentina/Buenos_Aires`. `MEAL_SLOTS` con etiqueta y orden: Desayuno, Almuerzo, Merienda, Cena, Snacks.

### T7.3 — Pantalla del plan (grilla)
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

### T7.4 — Aprobar, historial y duplicar
- **Depende de:** T7.3
- **Pasos:**
  1. Botón fijo "Aprobar plan" → `approve_plan` → toast. (La lista de compras se engancha en la Etapa 8.)
  2. Plan aprobado: se puede seguir editando; un banner avisa "Cambiaste el plan aprobado" (en la Etapa 8 ofrecerá actualizar la lista).
  3. Historial: lista de semanas anteriores con miniaturas; abrir una en solo lectura; "Repetir esta semana" → `duplicate_plan` a la semana elegida.
- **Aceptación:** duplicar mantiene recetas, momentos, comensales y sobras (con fechas corridas).

### T7.5 — Vista "Hoy"
- **Depende de:** T7.3
- **Archivos:** `app/(app)/g/[groupId]/hoy/page.tsx`, `components/today/*`.
- **Pasos:**
  1. Saludo + fecha. Tarjetas por momento de hoy: receta, quiénes comen, botón **Cocinar** (abre modo cocinar con `plan_entry_id`) o "Es sobra de ayer: calentar".
  2. "Mañana": vista previa + avisos derivados del plan ("Mañana hay pescado: pasalo del freezer a la heladera hoy a la noche" si la receta tiene `storage_info` o el ingrediente es congelado).
  3. Lugar reservado para tareas de meal prep (Etapa 9) y para la lista activa (Etapa 8).
  4. Sin plan: invitación a armar la semana.
- **Aceptación:** abrir la app a la noche muestra la cena y el botón Cocinar en la primera pantalla.

### T7.6 — Tiempo real en el plan
- **Depende de:** T7.3
- **Archivos:** `lib/hooks/use-realtime-plan.ts`.
- **Pasos:** suscripción a cambios de `meal_plan_entries` del plan abierto; aplicar cambios al estado local; indicador "Sofi está editando" con Presence.
- **Aceptación:** dos celulares ven los cambios del otro en < 2 s.

## 7b — Plan con IA

### T7.7 — Dominio: `validatePlan` 🧠
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

### T7.8 — Agente del plan (chat con tools) 🧠
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

### T7.9 — UI del chat del plan
- **Depende de:** T7.8
- **Archivos:** `components/plan/plan-chat-sheet.tsx`, `lib/hooks/use-plan-chat.ts`.
- **Pasos:**
  1. "Armar con IA" abre un bottom sheet en tres alturas (la grilla queda visible arriba).
  2. Primer mensaje sugerido con chips editables: "Armame la semana", "Solo cenas", "El jueves comemos afuera", "Quiero pescado 2 veces", "Recetas de menos de 30 min". Input de texto + botón de voz (`VoiceRecorder`).
  3. Mensajes con streaming; indicadores de herramientas ("Revisando tus recetas…").
  4. En `plan_updated`, la grilla se actualiza con una animación; las celdas nuevas o cambiadas se resaltan unos segundos; los warnings aparecen como ⚠️ en la celda con su explicación.
  5. Recetas nuevas propuestas por la IA con badge "Nueva" → tocar abre el borrador para revisarlo/editarlo.
- **Aceptación:** pedir "cambiá el miércoles por algo con carne" cambia solo esa celda.

### T7.10 — Recetas nuevas de la IA
- **Depende de:** T7.8
- **Pasos:** `meal_plan_entries.is_new_recipe` y `recipes.status = 'draft'` se muestran claros en el plan; las recetas `draft` no aparecen en el recetario hasta aprobar el plan (filtrar `status = 'active'` en `listRecipes`). Al aprobar, `approve_plan` las activa. Al descartar el borrador del plan, se borran.
- **Aceptación:** una receta inventada por la IA aparece en el recetario solo después de aprobar el plan.

### T7.11 — Evals del plan
- **Archivos:** `tests/evals/plan/*`.
- **Pasos:** recetario de prueba (25 recetas, 6 con cebolla) + 2 perfiles (uno sin cebolla y bajo en carbohidratos). 8 pedidos distintos. Chequeos: 0 errores de `validatePlan`, ≤ 2 warnings de monotonía, ≥ 70% recetas del recetario, ninguna receta repetida sin ser sobra. Imprime costo y tiempo.
- **Aceptación:** 8/8 sin errores.

---

## Cierre de la Etapa 7
- [ ] Prueba real: planificar una semana con la IA entre los dos.
- [ ] Revisar costo promedio por plan en `ai_runs`.

## Notas de ejecución
