# Etapa 5b — Preguntale: asistente de cocina

**Resultado:** desde la home, desde una receta o en medio de un paso del modo cocinar, le pregunto lo que sea ("¿le puedo poner brócoli?", "¿se puede freezar?", "¿esto sigue bien?") y me responde corto, sabiendo de qué receta y de qué paso hablo. Cito recetas con `@` y puedo preguntar por voz.
**Spec:** §3 F16 · §5.2 (`ai_conversations`, `ai_messages`) · §6.9 · §8.2 · canvas de diseño (fila "Preguntale": chat con @receta y "Preguntar mientras cocinás").

> Las tools que dependen de etapas posteriores (`get_today`, `get_my_diet_plan`, `propose_add_to_plan`, `propose_add_to_list`) se registran **solo si** su etapa ya existe. Al terminar las Etapas 7, 8 y 8b, sumarlas (ver T5B.6).

---

### [x] T5B.1 — Migración: conversaciones del asistente
- **Depende de:** T5.1
- **Archivos:** `supabase/migrations/<ts>_assistant.sql`, `supabase/tests/05b_assistant.test.sql`.
- **Pasos:**
  1. Agregar a `ai_conversations`: `context jsonb`, `title text`, `last_message_at timestamptz`; a `ai_messages`: `mentions uuid[]`. Índice GIN en `mentions` (para "Preguntas sobre esta receta").
  2. RLS: conversaciones con `purpose = 'assistant'` visibles y escribibles solo por su `user_id`.
- **Aceptación:** pgTAP: un miembro del mismo grupo no ve las conversaciones de otro.

### [x] T5B.2 — Motor del asistente (endpoint con tools)
- **Depende de:** T5B.1, T2.4, T6.5 si existe (si no, `check_compatibility` devuelve "sin perfil")
- **Archivos:** `app/api/ai/assistant/chat/route.ts`, `lib/ai/assistant/{agent,tools,prompt,context,events}.ts` + tests.
- **Pasos:**
  1. Streaming SSE. Input (Zod): `{ conversationId?, message, mentions: string[], context?: { origin: "home" | "recipe" | "cooking", recipeId?, cookingSessionId?, step? } }`. Valida que cada receta mencionada sea del grupo del usuario.
  2. `context.ts`: arma el bloque de contexto inicial: recetas citadas (ingredientes + pasos), y en modo cocinar la receta de la sesión, el paso actual con su texto, porciones y timers activos. Resumen corto de restricciones del usuario.
  3. Tools de consulta: `get_recipe`, `search_recipes`, `get_ingredient_info` (vida útil, conservación, familia), `check_compatibility(recipe_id, changes)`.
  4. Tools de acción que **solo proponen** y devuelven una tarjeta: `propose_recipe_change({ recipe_id, change_note, ops })` (mismas operaciones que `apply-cooking-edits`), `propose_note({ recipe_id, text })`.
  5. Loop con máximo 6 iteraciones. Eventos SSE: `text_delta`, `tool_started`, `proposal` (tarjeta), `done`, `error`.
  6. Modelo: `MODELS.fast`; pasar a `MODELS.smart` si hay ≥ 2 menciones o el origen es plan. En `origin = "cooking"`, instrucción de responder en ≤ 3 oraciones.
  7. System prompt: voseo, breve y práctico; seguridad alimentaria conservadora (vencimientos, freezer, recalentar); nunca consejo médico; si sugiere sumar un ingrediente, llamar antes a `check_compatibility`.
  8. Persistir mensajes (con `mentions`) y actualizar `title` (primeras palabras de la primera pregunta) y `last_message_at`. Cuota `assistant`. Registrar en `ai_runs`.
  9. Tests con el modelo mockeado: menciona una receta ajena → 403; propone brócoli → se llama `check_compatibility`; origen cocina → el contexto incluye el paso.
- **Aceptación:** "@Pollo al limón ¿le puedo poner brócoli?" responde mencionando en qué paso agregarlo y si es apta.

### [x] T5B.3 — UI del chat y menciones con @
- **Depende de:** T5B.2
- **Archivos:** `app/(app)/g/[groupId]/preguntar/page.tsx`, `components/assistant/{chat,composer,mention-picker,message,proposal-card}.tsx`, `lib/hooks/use-assistant-chat.ts`.
- **Pasos:**
  1. Pantalla "Preguntale" (canvas): header con subtítulo "Conoce tus recetas, tu plan y lo que compraste", mensajes con streaming, sugerencias rápidas como chips.
  2. **Composer:** input + botón `@` + botón de voz. Escribir `@` (o tocar el botón) abre el `mention-picker` con búsqueda en vivo de recetas del grupo (`search_recipes` del lado del cliente con debounce); elegir inserta un chip no editable en el texto. Soporta varias menciones. Teclado: flechas + Enter.
  3. Mensajes del usuario muestran los chips de receta; tocar un chip abre la receta.
  4. **Tarjetas de propuesta** (`proposal`): "Sumarlo a la receta" → muestra el diff (reusa `recipe-diff`) → confirmar → `save_recipe` con `origin = 'edit'` y `change_note`. "Anotar en la receta" → agrega nota.
  5. Historial: lista de conversaciones recientes (desde el header) y "Nueva pregunta".
  6. Accesos: botón **Preguntar** en la home (header), en el detalle de receta ("Preguntar por esta receta" → abre con la receta citada) y en la sección "Preguntas sobre esta receta" del detalle.
- **Aceptación:** citar dos recetas con `@`, preguntar, y aplicar una propuesta de cambio que crea una versión nueva.

### [x] T5B.4 — Preguntar mientras cocinás
- **Depende de:** T5B.3, T3.2, T5.2
- **Archivos:** `components/cooking/ask-sheet.tsx`, `lib/hooks/use-speak.ts`, ajustes en `cooking-stories.tsx`.
- **Pasos:**
  1. Botón de pregunta en el header de cada paso (canvas "Modo cocinar") → bottom sheet sobre el paso, con chip "Paso 4 · Dorar el pollo". El contexto viaja con `origin: "cooking"`, `cookingSessionId` y `step`. La conversación es una por sesión de cocina.
  2. Botón grande **"Tocá y hablá"** (`VoiceRecorder`); al soltar, transcribe y envía sin pasos extra.
  3. `useSpeak`: lee la respuesta en voz alta con `speechSynthesis` (voz `es-AR` si existe, si no `es-*`), activable con un toggle que se recuerda. Se corta si el usuario vuelve a hablar.
  4. Los timers siguen corriendo y el chip flotante sigue visible; cerrar el sheet vuelve al mismo paso.
  5. Si la respuesta propone cambiar el paso, la tarjeta ofrece "Aplicar en esta sesión" (va a `pending_edits`, T3.6) en vez de cambiar la receta directo.
- **Aceptación:** en el celular, con un timer corriendo, preguntar por voz y escuchar la respuesta sin salir del paso.

### [x] T5B.5 — Evals del asistente
- **Archivos:** `tests/evals/assistant/*`.
- **Pasos:** 20 preguntas con recetario y perfil de prueba: reemplazos, freezer, vencimientos ("pollo cocido de hace 5 días"), combinaciones, preguntas en modo cocinar. Chequeos automáticos: no sugiere ingredientes prohibidos para el usuario; en vencimientos dudosos recomienda no consumir; en modo cocinar ≤ 3 oraciones; cita el paso correcto cuando hay receta mencionada.
- **Aceptación:** ≥ 90% de casos pasan; 0 sugerencias con prohibidos.

### T5B.6 — Sumar contexto de etapas posteriores
- **Depende de:** T5B.2 y, según corresponda, T7.5, T8.3, T8B.2
- **Pasos:** al completarse esas etapas, registrar las tools `get_today()` (plan del día + lista activa), `get_my_diet_plan()` (fórmula del momento, permitidos), `propose_add_to_plan`, `propose_add_to_list`, y sumar sus casos a los evals.
- **Aceptación:** "¿qué ceno hoy que encaje en mi plan?" usa el plan del día y el plan vivo.
- **Nota:** esta tarea se ejecuta después de la Etapa 8b.

---

## Cierre de la Etapa 5b
- [ ] Prueba real: cocinar una receta haciendo 3 preguntas por voz.
- [ ] Revisar costo promedio por conversación en `ai_runs`.

## Notas de ejecución

- T5B.1: las columnas `context`, `title`, `last_message_at` y `mentions` ya estaban desde la migración de IA (T5.1). Acá se agregaron las policies de escritura propia (insert exige ser el dueño y miembro del grupo; update/delete del dueño; `ai_messages` solo en conversaciones propias) para que el endpoint use el cliente del usuario y respete RLS en vez del service role, y el índice GIN de `mentions`. 7 tests pgTAP en `05b_assistant.test.sql`: un miembro del mismo grupo no ve ni escribe las conversaciones de otro.

- T5B.2: `POST /api/ai/assistant/chat` (SSE: `text_delta`, `tool_started`, `proposal`, `done`, `error`). Valida sesión, membresía del grupo, que cada receta citada sea del grupo (403 si no) y cuota `assistant`; la conversación y los mensajes se guardan con el cliente del usuario (RLS). Tools de consulta (`get_recipe`, `search_recipes`, `get_ingredient_info`, `check_compatibility`) y de propuesta (`propose_recipe_change` con las mismas operaciones de `apply-cooking-edits`, `propose_note`); loop de máx. 6 vueltas. `check_compatibility` es un stub ("sin_perfil") hasta T6.5, y `get_today`/`get_my_diet_plan`/`propose_add_to_*` se suman en T5B.6. Modelo: Haiku; Sonnet si se citan ≥ 2 recetas (con `tool_choice` automático, ver T5.4). En modo cocinar el cliente manda `step`, `servings` y `timers` (viven en localStorage, el servidor no los conoce). Verificado con la IA real: pregunta de brócoli con receta citada (llama a `check_compatibility`, indica paso y cantidad), propuesta de nota y de cambio, modo cocinar en 2 oraciones, "pollo cocido de hace 5 días → ante la duda, no" y 403 al citar una receta ajena. Se pide texto plano (sin markdown) porque el chat no lo renderiza. 6 tests del agente con cliente simulado.

- T5B.3: pantalla `/g/[groupId]/preguntar` en un grupo de rutas `(chat)` (alto completo, sin barra inferior). El composer cita recetas con `@` o con el botón @: las recetas del grupo se cargan una vez (`listRecipesForMention`) y se filtran en el cliente sin acentos (la búsqueda de texto completo no encuentra palabras parciales, hallazgo del e2e); las citas quedan como chips arriba del campo y en el mensaje enviado (adaptación: el plan decía chips dentro del texto). Las tarjetas de propuesta piden confirmar: "Sumarlo a la receta" aplica las operaciones con `applyCookingEdits` y guarda con `save_recipe` (versión nueva con `change_note`); "Anotar en la receta" agrega "Nota: …" al final de la descripción (no hay tabla de notas). Historial en una hoja, "Nueva pregunta" y accesos desde Hoy (botón Preguntar), el detalle ("Preguntar por esta receta") y la sección "Preguntas sobre esta receta". e2e con la respuesta del modelo mockeada + 403 real al citar una receta ajena.

- T5B.4: botón de pregunta en el header de cada paso abre `AskSheet` (hoja sobre el paso, chip "Paso 4 · …"). El panel queda montado, así que hay **una conversación por sesión de cocina**. El contexto (receta, pantalla actual, porciones y timers de esta receta con su tiempo restante) se calcula al enviar cada pregunta desde el store de timers. "Tocá y hablá" usa `VoiceRecorder` con `autoSend` (transcribe y manda sin pasos extra); también hay campo de texto. `useSpeak` lee la respuesta con `speechSynthesis` (es-AR, si no es-*; toggle que se recuerda; se corta al cerrar o al volver a preguntar). Las propuestas de cambio ofrecen "Aplicar en esta sesión" (van a los ajustes de la sesión de T3.6) en vez de "Sumarlo a la receta". Límite conocido: el asistente ve la receta original; si la sesión ya tiene ajustes, los índices de una propuesta pueden quedar desfasados. Los timers siguen y al cerrar se vuelve al mismo paso (e2e). El micrófono y la voz de salida no se pueden automatizar: quedan para la prueba en el celular.

- T5B.5: 20 preguntas (reemplazos, agregados con compatibilidad, freezer, vencimientos, combinaciones con dos recetas y modo cocinar) con recetario, catálogo y perfil de prueba **en memoria** (`tests/evals/assistant/fixtures.ts`; el perfil real llega en la Etapa 6, hasta entonces el `check_compatibility` del eval aplica un perfil simulado: sin cebolla ni maní, harinas limitadas de noche). Chequeos automáticos: usa las herramientas esperadas, rechaza lo prohibido, es conservadora con vencimientos ("ante la duda, no"), ≤ 3 oraciones en modo cocinar, cita el paso, sin markdown, y en TODOS los casos ningún ingrediente prohibido se recomienda. `pnpm eval:assistant [prefijo…]` (`EVAL_VERBOSE=1` imprime las respuestas que fallan); no corre en CI. **Resultado en 3 corridas: 90% (2 marcas de maní que eran advertencias, falsos positivos del chequeo), 100% y 100%; 0 sugerencias con prohibidos; ~USD 0,10 por los 20 (≈ 0,5 centavos por pregunta).**
