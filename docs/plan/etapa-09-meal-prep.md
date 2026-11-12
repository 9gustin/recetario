# Etapa 9 — Meal prep y tips

**Resultado:** al aprobar el plan, la app sugiere qué preparar con anticipación (cortar, porcionar, freezar, descongelar), en qué día y cuánto tiempo lleva, y da tips de variedad y conservación.
**Spec:** §3 F8 · §5.2 (`prep_tasks`) · §6.6.

---

### [x] T9.1 — Pipeline post-aprobación en streaming (sin cola)
- **Depende de:** T8.3 · decisión de la persona: **sin servicio de colas** (ni Inngest ni workers); todo es backend en streaming.
- **Archivos:** `lib/ai/stream.ts` (helper SSE), `app/api/plans/[id]/finalize/route.ts`, `lib/plans/finalize.ts`.
- **Pasos:**
  1. Helper `lib/ai/stream.ts`: convierte el stream de `@anthropic-ai/sdk` (`messages.stream`) en una respuesta SSE con eventos tipados (`delta`, `step`, `done`, `error`). Reutilizable por el chat del plan, Preguntale y este pipeline.
  2. Al aprobar un plan, el cliente abre `POST /api/plans/{id}/finalize` (Route Handler, `export const maxDuration` según el plan de Vercel). El handler corre pasos secuenciales: `generate-shopping-list` → `enrich-shopping-list` → `generate-prep-tasks`, emitiendo un evento por paso y por cada resultado parcial.
  3. Cada paso es idempotente y guarda su resultado en la base apenas termina (borrador). Si se corta la conexión, la UI lo ve por realtime y un botón "Reintentar" reanuda desde el último paso sin duplicar.
  4. Mover la generación y el enriquecimiento de la Etapa 8 a estos pasos.
  5. Estado visible en el plan ("Armando tu lista y tus preparaciones…").
- **Aceptación:** aprobar un plan muestra el avance en vivo; si la IA falla en un paso, lo ya guardado queda y se puede reintentar sin duplicar.

### T9.2 — Generar tareas de meal prep
- **Depende de:** T9.1, T7.7
- **Archivos:** `lib/ai/prep/generate.ts`, `lib/ai/prompts/meal-prep.ts`, `lib/schemas/prep.ts`, `lib/domain/validate-prep.ts` + test.
- **Pasos:**
  1. Input al modelo (`MODELS.smart`): entradas del plan con recetas, pasos y tiempos; vida útil de ingredientes; equipamiento y tiempo disponible de los miembros (perfil); fechas de compra.
  2. Salida: `tasks[]` (`title`, `details`, `suggested_date`, `duration_minutes`, `kind`, `related_entry_ids`, `remind_at` opcional) + `tips[]` de la semana.
  3. `validatePrep`: ninguna tarea antes de la compra del ingrediente; lo preparado no puede superar su vida útil hasta el uso (si no, la tarea debe ser "freezar"); tareas de descongelar 12–24 h antes del uso.
  4. Tareas inválidas → se descartan y se registra el motivo (sin reintentar todo).
  5. Guardar en `prep_tasks` reemplazando las anteriores no completadas del plan.
- **Aceptación:** para un plan con pollo 3 veces, sugiere cortar y porcionar el día de la compra y freezar lo del final de la semana.

### T9.3 — UI de preparaciones
- **Depende de:** T9.2
- **Archivos:** `components/prep/*`, pestaña "Preparación" en la pantalla del plan, sección en "Hoy".
- **Pasos:**
  1. En el plan: pestaña "Preparación" con las tareas agrupadas por día, duración total por día ("Domingo · 50 min").
  2. En "Hoy": tareas del día con checkbox; las de descongelar destacadas.
  3. Marcar como hecha (`done_at`, `done_by`), editar día, borrar, agregar una manual.
  4. Tips de la semana en una tarjeta plegable.
- **Aceptación:** las tareas aparecen el día que corresponde y se pueden tildar.

### T9.4 — Variedad y conservación
- **Depende de:** T9.2
- **Pasos:**
  1. En el detalle de cada ingrediente de la lista: tips de conservación del catálogo ("guardá las hojas secas con papel en un táper").
  2. Al aprobar el plan, si `validatePlan` tuvo warnings de monotonía, sugerir alternativas concretas (ej. 3 ensaladas distintas con lo que ya se compra) como tips.
  3. En la ficha de cada receta: `storage_info` (cuánto dura en heladera/freezer, cómo recalentar), generado una vez con `MODELS.fast` y guardado.
- **Aceptación:** cada receta del plan tiene info de conservación visible.

---

## Cierre de la Etapa 9
- [ ] Prueba real: hacer el meal prep del domingo con las sugerencias.

## Notas de ejecución

- T9.1: Pasos shopping-list → enrich-list (el de preparaciones se suma en T9.2); fallo no crítico no corta, reintento por paso con {only}. Si el cliente se va, el trabajo sigue (emit tolerante).
