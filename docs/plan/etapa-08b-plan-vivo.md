# Etapa 8b — Plan vivo

**Resultado:** subo el plan de la nutricionista (PDF, foto o audio), la IA lo convierte en algo simple por momento del día, lo ajusto charlando ("no me gusta el yogur" → reemplazos equivalentes), y día a día registro con un toque si cumplí, cambié algo o usé un permitido.
**Spec:** §3 F14 (y F5, F6, F15 para la integración) · §5.2 (Plan vivo) · §6.7 · §8.1, §8.2 · canvas de diseño (fila "Plan vivo": Digitalizar mi plan, Mi plan, Registrar).

---

### [x] T8B.1 — Migración: plan vivo y registro
- **Depende de:** T6.1, T7.1
- **Archivos:** `supabase/migrations/<ts>_diet_plans.sql`, `supabase/tests/08b_diet_plans.test.sql`.
- **Pasos:**
  1. Tablas `diet_plans`, `diet_plan_meals`, `diet_plan_swaps`, `diet_plan_versions`, `meal_logs` (§5.2). Un solo plan `active` por usuario (índice parcial único).
  2. RLS: todo solo para el propio usuario.
  3. RPC `save_diet_plan(p_plan jsonb, p_change_note text)` transaccional: reemplaza comidas, incrementa versión y guarda snapshot.
  4. RPC `get_group_meal_rules(p_group_id)` (security definer): para cada miembro con plan activo devuelve **solo** `slot`, `formula` y `components` (para que el plan semanal y las ideas los respeten). Nunca registros, reemplazos ni archivos.
  5. RPC `log_meal(p_date, p_slot, p_status, p_note)` → upsert por `(user_id, date, slot)`.
- **Aceptación:** pgTAP: B (mismo grupo) obtiene las fórmulas de A vía RPC pero no puede leer `meal_logs` ni `diet_plans` de A.

### T8B.2 — Dominio: adherencia y permitidos
- **Depende de:** T7.2
- **Archivos:** `lib/domain/adherence.ts` + test, `lib/schemas/diet-plan.ts`.
- **Pasos:**
  1. Zod: `DietPlanDraft` (comidas con `slot`, `days?`, `formula`, `components[]` con `group` y `portion?`, `options[]`; `rules[]`; `allowances { per_week, definition }`; `restrictions[]` para F5; `starts_on`, `ends_on`, `next_checkup`; `open_questions[]`).
  2. `weekAdherence(logs, plan, weekStart)` → `{ percent, bySlotDay[][], allowancesUsed, allowancesLeft, pending }`. "Cambié algo" cuenta como medio cumplimiento; los permitidos dentro del tope cuentan como cumplidos; los que superan el tope, no.
  3. `todayPlan(plan, date)` → comidas que tocan hoy (respetando `days`) con el reemplazo aplicado si existe.
  4. Tests: semana completa, permitidos al límite y excedidos, comidas sin registrar, días específicos.
- **Aceptación:** 100% de ramas cubiertas.

### T8B.3 — Digitalizar el plan (ingesta con IA)
- **Depende de:** T8B.1, T8B.2, T5.1, T5.2
- **Archivos:** `app/api/ai/diet-plan/ingest/route.ts`, `lib/ai/prompts/diet-plan.ts`, `lib/ai/diet-plan/ingest.ts`.
- **Pasos:**
  1. Input: `filePaths[]` (PDF/imágenes en el bucket `profile-inputs`), `transcript?`, `text?`. Cada entrada se guarda en `food_profile_inputs`.
  2. `runStructured` (`MODELS.smart`) con documentos/imágenes como bloques → `DietPlanDraft`. Reglas del prompt: resumir sin perder porciones ni reglas; separar fórmula (qué tipo de comida) de opciones concretas; detectar permitidos y su tope; no inventar lo que el PDF no dice (va a `open_questions`); texto en voseo.
  3. Guarda `diet_plans` en `draft` y devuelve el draft + preguntas.
  4. Las `restrictions` se proponen al perfil (F5) como un draft de perfil, para confirmar ahí.
- **Aceptación:** con un PDF de ejemplo de 10+ páginas (fixture en `tests/evals/fixtures/`) devuelve 4–5 comidas con fórmula, reglas y permitidos, en < 40 s.

### T8B.4 — Ajustar el plan charlando
- **Depende de:** T8B.3
- **Archivos:** `app/api/ai/diet-plan/[id]/chat/route.ts`, `lib/ai/diet-plan/{agent,tools}.ts`, `app/(app)/perfil/plan/digitalizar/page.tsx`, `components/diet-plan/*`.
- **Pasos:**
  1. Pantalla **Digitalizar mi plan** (canvas): pasos 1) subir (PDF/foto/audio/texto), 2) ajustar, 3) confirmar. Tarjeta del archivo leído ("Leído · 14 páginas → 4 comidas por día").
  2. Chat con streaming. Tools: `propose_swaps({ meal_id, dislike })` → 3 reemplazos que respetan `components` de esa comida (validados contra prohibidos del perfil con `checkRecipe`/familias); `apply_swap`, `update_meal`, `update_rule`, `answer_question`.
  3. Los reemplazos se muestran como opciones tocables; elegir uno lo aplica (y crea versión).
  4. "Ver cómo quedó mi plan" → confirma (`status = 'active'`, archiva el anterior).
- **Aceptación:** "no me gusta el yogur del desayuno" propone 3 reemplazos con proteína + lácteo y ninguno con prohibidos.

### T8B.5 — Pantalla "Mi plan"
- **Depende de:** T8B.4
- **Archivos:** `app/(app)/perfil/plan/page.tsx`, `components/diet-plan/today-plan.tsx`, `components/diet-plan/allowances.tsx`, tarjeta en `app/(app)/perfil/page.tsx`.
- **Pasos:**
  1. Header "Mi plan · Semana 3 de 8 · lo ajustaste 4 veces" + botón ✏️ (vuelve al chat de ajuste).
  2. Dos tarjetas: % cumplido de la semana y permitidos (círculos usados/libres + "te quedan 2").
  3. **Hoy toca:** cada comida con su fórmula, ✓ si ya está registrada; la comida que coincide con el plan semanal muestra la receta ("En el plan: salmón con rúcula y palta").
  4. **Tus reemplazos** como chips.
  5. Botón principal "Registrar lo que comí". En Perfil, tarjeta "Mi plan · semana 3" con anillo de progreso.
- **Aceptación:** coincide con el diseño del canvas a 375 px en los tres temas.

### T8B.6 — Registrar y seguimiento
- **Depende de:** T8B.5
- **Archivos:** `app/(app)/perfil/plan/registrar/page.tsx`, `components/diet-plan/log-meal.tsx`, `components/diet-plan/week-grid.tsx`, `app/api/ai/meal-logs/classify/route.ts`.
- **Pasos:**
  1. Tarjeta de la comida actual (por hora) con tres botones grandes: **Cumplí** · **Cambié algo** · **Permitido** (deshabilitado con aviso si ya se usaron todos). Elegir otra comida/día con un selector.
  2. "O contá qué comiste" (texto o voz) → `classify` (Haiku) sugiere el estado con una frase; la persona confirma.
  3. Grilla semanal (momentos × días) con colores por estado + leyenda; % cumplido y mensaje corto positivo ("Vas muy bien. Te quedan 2 permitidos hasta el domingo").
  4. Historial de semanas y "Compartir resumen" (texto para mandar a la nutricionista).
  5. Al terminar una sesión de modo cocinar con `plan_entry_id`, registrar automáticamente "Cumplí" para cada comensal con plan vivo (con toast "Registrado · deshacer").
- **Aceptación:** registrar una comida lleva un toque; la grilla y los permitidos se actualizan al instante.

### T8B.7 — Integración con plan semanal e ideas
- **Depende de:** T8B.1, T7.8, T7.12
- **Archivos:** ajustes en `lib/domain/validate-plan.ts`, `lib/ai/plan-agent/tools.ts`, `lib/ai/suggest/*`.
- **Pasos:**
  1. `get_participants` del agente del plan incluye las fórmulas por momento (`get_group_meal_rules`).
  2. `validatePlan`: nuevo warning `MEAL_RULE_MISMATCH` cuando una receta no encaja en la fórmula de ese momento para algún comensal (ej. harinas en la cena). Clasificación receta ↔ fórmula por grupos de alimentos del catálogo (`family` → `proteina`, `verdura`, `carbohidrato`, `lacteo`, `fruta`, `grasa`).
  3. ¿Qué tenés? e Ideas filtran/ordenan por encaje con la fórmula del momento.
- **Aceptación:** con un plan vivo "cena sin harinas", el plan con IA no propone pastas a la noche y las ideas de la cena tampoco.

### T8B.8 — Evals y E2E
- **Archivos:** `tests/evals/diet-plan/*`, `tests/e2e/diet-plan.spec.ts`.
- **Pasos:** evals con 3 planes de ejemplo (PDF, foto, audio transcripto): comidas y permitidos detectados, reemplazos válidos. E2E: subir PDF de prueba (IA mockeada) → ajustar con un reemplazo → activar → registrar 3 comidas y un permitido → grilla y contador correctos.
- **Aceptación:** evals ≥ 90%; e2e en verde.

---

## Cierre de la Etapa 8b
- [ ] Revisión de privacidad 🧠: el grupo solo ve fórmulas y restricciones, nunca registros ni PDFs.
- [ ] Prueba real: cargar el plan de la nutricionista y registrarlo durante una semana.

## Notas de ejecución

- T8B.1: Se agregó open_questions a diet_plans y activate_diet_plan (archiva el activo anterior). meal_logs.cooking_session_id sin FK por ahora.
