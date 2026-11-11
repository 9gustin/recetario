# Etapa 9 — Meal prep y tips

**Resultado:** al aprobar el plan, la app sugiere qué preparar con anticipación (cortar, porcionar, freezar, descongelar), en qué día y cuánto tiempo lleva, y da tips de variedad y conservación.
**Spec:** §3 F8 · §5.2 (`prep_tasks`) · §6.6.

---

### T9.1 — Jobs en segundo plano (Inngest)
- **Depende de:** T8.3 · 👤 cuenta de Inngest e integración con Vercel (`INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`).
- **Archivos:** `inngest/client.ts`, `inngest/functions/plan-approved.ts`, `app/api/inngest/route.ts`.
- **Pasos:**
  1. `pnpm add inngest`. Dev server local con `pnpm dlx inngest-cli dev` (documentarlo en el README).
  2. Al aprobar un plan se emite `plan/approved { planId }`.
  3. Función `plan-approved` con steps idempotentes: `generate-shopping-list` → `enrich-shopping-list` → `generate-prep-tasks`. Reintentos automáticos por step.
  4. Mover la generación y el enriquecimiento de la Etapa 8 a estos steps (la UI ya escucha por realtime).
  5. Estado del job visible en el plan ("Armando tu lista y tus preparaciones…").
- **Aceptación:** aprobar un plan dispara el job; si la IA falla, la lista existe igual y el step se reintenta.

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
