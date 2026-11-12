# Etapa 5 — IA: importar recetas y voz

**Resultado:** cargo una receta pegando texto, un link, sacándole una foto al cuaderno o dictándola, y en segundos tengo un borrador con ingredientes y pasos con tiempos para revisar.
**Spec:** §3 F3 (crear receta), F9 · §6 (patrón común, 6.1, 6.3, 6.7) · §5.2 (`ai_runs`).

---

### T5.1 — Infraestructura de IA
- **Depende de:** T2.4 · 👤 `ANTHROPIC_API_KEY` en `.env.local` y en Vercel.
- **Archivos:** `lib/ai/client.ts`, `lib/ai/models.ts`, `lib/ai/run-structured.ts`, `lib/ai/rate-limit.ts`, `supabase/migrations/<ts>_ai.sql`, `lib/ai/run-structured.test.ts`.
- **Pasos:**
  1. `pnpm add @anthropic-ai/sdk`. `client.ts` con `import "server-only"`.
  2. `models.ts`: `export const MODELS = { smart: "claude-sonnet-5-5", fast: "claude-haiku-5-5" } as const`.
  3. Migración: `ai_runs`, `ai_conversations`, `ai_messages` (§5.2) con RLS (solo lectura del propio usuario; escritura vía service role). Tabla `ai_quota (user_id, day date, feature text, count int)`.
  4. `runStructured<T>({ feature, model, system, content, schema: ZodType<T>, maxTokens })`:
     - Convierte el Zod a JSON Schema (`z.toJSONSchema`) y lo pasa como **una tool** con `tool_choice: { type: "tool", name }`.
     - Valida la salida con Zod; si falla, **un** reintento agregando el error de validación como mensaje.
     - System prompt con `cache_control` (cache de prompts).
     - Registra en `ai_runs` (tokens, latencia, estado, error) siempre, también en fallas.
     - Devuelve `{ ok: true, data, runId } | { ok: false, error }`.
  5. `rate-limit.ts`: `checkQuota(userId, feature, limit)` con incremento atómico (RPC `consume_ai_quota`). Límites por defecto en un objeto (`parse_recipe: 30/día`, `food_profile: 20/día`, `plan_chat: 60 mensajes/día`).
  6. Test con el cliente mockeado: salida válida, salida inválida → reintento, segunda falla → error.
- **Aceptación:** un script `scripts/ai-smoke.ts` (`pnpm tsx`) llama a `runStructured` con un esquema simple y queda registrado en `ai_runs`.

### T5.2 — Voz: grabar y transcribir
- **Depende de:** T5.1 · 👤 decidir proveedor y cargar su API key (`TRANSCRIPTION_PROVIDER`, `OPENAI_API_KEY` o `DEEPGRAM_API_KEY`).
- **Archivos:** `lib/transcription/index.ts`, `lib/transcription/{openai,deepgram}.ts`, `app/api/transcribe/route.ts`, `components/voice/voice-recorder.tsx`, `lib/hooks/use-recorder.ts`, migración del bucket `audio`.
- **Pasos:**
  1. Interfaz `Transcriber { transcribe(audio: Blob | Buffer, mime: string, opts: { language: "es", prompt?: string }): Promise<string> }`. Implementar los dos proveedores; elegir por env var.
  2. Bucket privado `audio` con path `<user_id>/<uuid>.<ext>`; policy: el usuario solo accede a su carpeta.
  3. `useRecorder`: `MediaRecorder` eligiendo el mime soportado (`audio/webm;codecs=opus` o `audio/mp4` en iOS), límite de 5 min, nivel de audio para animar el botón, cancelar.
  4. `VoiceRecorder`: botón grande redondo "Tocá para hablar" → grabando (pulso + tiempo) → "Listo" → sube → `POST /api/transcribe { path }` → devuelve el texto. Muestra el texto editable antes de usarlo.
  5. `/api/transcribe`: valida sesión, que el path sea del usuario, cuota; descarga de Storage; transcribe con un `prompt` de vocabulario de cocina rioplatense ("zapallito, morrón, verdeo, milanesa…").
  6. 👤 **Prueba de calidad:** grabar 3 audios reales y comparar proveedores; anotar la elección en "Notas de ejecución".
- **Aceptación:** dictar 30 segundos en el celular (iOS y Android) devuelve un texto correcto.

### T5.3 — Importar desde URL
- **Depende de:** T5.1
- **Archivos:** `lib/import/fetch-url.ts`, `lib/import/json-ld.ts` + tests con fixtures HTML en `tests/fixtures/recipes/`.
- **Pasos:**
  1. `fetchUrl(url)`: solo `http/https`; **protección SSRF** (resolver DNS y rechazar IPs privadas, loopback y link-local); timeout 10 s; máximo 3 MB; `User-Agent` genérico de la app.
  2. `extractJsonLdRecipe(html)`: busca `schema.org/Recipe` (incluyendo dentro de `@graph`) y lo mapea a `RecipeDraft` (ingredientes con `parseIngredientLine`, `recipeInstructions` en pasos, `totalTime` ISO 8601 → minutos, imagen).
  3. Si no hay JSON-LD: extraer texto principal (quitar scripts, nav, footer) y truncarlo a ~15k caracteres para la IA.
- **Aceptación:** tests con 3 fixtures (una con JSON-LD simple, otra con `@graph`, otra sin JSON-LD).

### T5.4 — Endpoint de parseo de recetas
- **Depende de:** T5.1, T5.3, T2.3
- **Archivos:** `app/api/ai/recipes/parse/route.ts`, `lib/ai/prompts/parse-recipe.ts`, `lib/ai/recipes/parse.ts`, `lib/ai/ingredients/create-entry.ts`.
- **Pasos:**
  1. Input (Zod): `{ groupId, source: { kind: "text", text } | { kind: "url", url } | { kind: "image", paths: string[] } | { kind: "voice", transcript } }`.
  2. URL con JSON-LD completo → **sin IA**, salvo un paso Haiku para estimar duración y tipo de cada paso.
  3. Resto → `runStructured` con `MODELS.smart` (para imagen) o `MODELS.fast` (texto), esquema `RecipeDraft`. Las imágenes se mandan como bloques de imagen (subidas antes al bucket `recipe-images` en `<group>/imports/`).
  4. Prompt (español): separar un paso por acción; estimar `duration_seconds` y `timer_kind` (pasivo si es horno, hervor, reposo, marinado, freezer); detectar porciones; no inventar ingredientes que no estén; las cantidades vagas quedan con `quantity: null`; sugerir etiquetas de la lista existente.
  5. Post-proceso: resolver `ingredient_id` (local → `search_ingredients` con umbral) y, para los que no matchean, `createCatalogEntry(name)` con Haiku (esquema = fila de `ingredients`, `created_by_ai = true`, `reviewed = false`) usando el cliente admin.
  6. Devuelve el borrador (no guarda la receta).
- **Aceptación:** 5 entradas de ejemplo (una de cada tipo + una "desprolija") devuelven borradores válidos.

### T5.5 — UI de importación
- **Depende de:** T5.2, T5.4
- **Archivos:** `components/recipes/new-recipe-menu.tsx`, `app/(app)/g/[groupId]/recetas/importar/page.tsx`, `components/recipes/import/*`, ajustes en `recipe-form`.
- **Pasos:**
  1. FAB "+" abre un menú: **Escribirla**, **Pegar texto o link**, **Sacarle foto**, **Dictarla**.
  2. Cada opción tiene su pantalla simple; "Procesando…" con mensajes cálidos ("Leyendo tu receta…", "Separando los pasos…").
  3. Resultado → `recipe-form` precargado (`source_type` correspondiente), con un aviso arriba "Revisá que esté todo bien antes de guardar" y los ingredientes no reconocidos resaltados.
  4. Errores: cuota agotada, foto ilegible, link sin receta → mensajes claros con opción de reintentar o cargarla a mano.
- **Aceptación:** de foto a receta guardada en < 1 minuto.

### T5.6 — Evals de parseo
- **Archivos:** `tests/evals/parse-recipe/cases/*.json`, `tests/evals/parse-recipe/run.ts`, script `eval:parse`.
- **Pasos:** 15 casos (texto, voz transcripta, 3 imágenes en `tests/evals/fixtures/`) con chequeos automáticos: JSON válido, cantidad de ingredientes esperada ±1, ingredientes clave presentes, ningún paso sin verbo, pasos de horno con `timer_kind = passive` y duración. Imprime una tabla de resultados y costo total. **No corre en CI.**
- **Aceptación:** ≥ 90% de casos pasan; resultado anotado en "Notas de ejecución".

---

## Cierre de la Etapa 5
- [ ] Variables de IA y transcripción en Vercel 👤.
- [ ] Prueba real: cargar 5 recetas de la casa por voz o foto.
- [ ] Revisar `ai_runs` para ver costo y latencia promedio.

## Notas de ejecución
- Proveedor de transcripción (decisión de la persona, 2026-11-12): **OpenAI `gpt-4o-transcribe`** con `language=es`. Es el único proveedor; se salteó la comparación con Deepgram para simplificar. Esto deja hecho el paso 6 de T5.2 (la prueba de calidad con audios reales queda para validar al implementar la dictada en el celular). `TRANSCRIPTION_PROVIDER=openai`, key en `OPENAI_API_KEY`. La interfaz `Transcriber` sigue siendo intercambiable por si más adelante se quiere otro.
