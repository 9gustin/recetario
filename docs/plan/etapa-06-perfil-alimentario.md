# Etapa 6 — Perfil alimentario

**Resultado:** cada persona cuenta por voz, texto o archivos cómo come y qué plan sigue; la IA lo convierte en un perfil que la persona revisa, y las recetas muestran si son aptas para cada miembro del grupo.
**Spec:** §3 F5, F9 ("Adaptar a mi perfil") · §5.2 (Perfil alimentario) · §5.3 · §6.2 · §12 (decisión sobre familia `allium`).

---

### [x] T6.1 — Migración: perfiles alimentarios
- **Depende de:** T5.1
- **Archivos:** `supabase/migrations/<ts>_food_profiles.sql`, `supabase/tests/06_food_profiles.test.sql`.
- **Pasos:**
  1. Tablas `food_profiles`, `food_profile_inputs` (§5.2) y `food_profile_drafts (id, user_id, proposed jsonb, changes jsonb, open_questions jsonb, input_ids uuid[], status text check (status in ('pending','applied','discarded')))`.
  2. RLS: todo solo para el propio usuario.
  3. Bucket privado `profile-inputs` (`<user_id>/…`), solo el dueño.
  4. RPC `get_group_diet(p_group_id) returns table(user_id, display_name, restrictions jsonb, goals jsonb)` (security definer): exige que quien llama sea miembro; devuelve **solo** `restrictions` y `goals` de los miembros. Nunca `summary`, inputs ni archivos.
- **Aceptación:** pgTAP: B (mismo grupo) obtiene las restricciones de A vía RPC pero no puede leer `food_profiles` ni `food_profile_inputs` de A; C (otro grupo) no obtiene nada.

### T6.2 — Esquema del perfil
- **Depende de:** T6.1
- **Archivos:** `lib/schemas/food-profile.ts` + test.
- **Pasos:** Zod de `FoodProfileData` exactamente como §6.2 (`restrictions[]` con `target`, `type: ingredient|family|category`, `severity: forbidden|limit`, `reason?`, `limit?`, `includes?`; `goals[]`; `likes`; `dislikes`; `cuisines`; `schedule`; `equipment`; `skill`; `valid_until`). Más `FoodProfileProposal = { profile, summary, changes[], open_questions[] }`. Helpers `emptyProfile()`, `mergeProfiles()` (para aplicar ediciones manuales).

### T6.3 — Endpoint de ingesta
- **Depende de:** T6.2, T5.2
- **Archivos:** `app/api/ai/food-profile/ingest/route.ts`, `lib/ai/prompts/food-profile.ts`, `lib/ai/food-profile/ingest.ts`.
- **Pasos:**
  1. Input: `{ text?: string, transcript?: string, filePaths?: string[], answers?: { question: string, answer: string }[] }`. Guarda cada entrada en `food_profile_inputs`.
  2. Arma el mensaje: perfil actual (JSON) + nuevas entradas; PDFs como bloques `document` e imágenes como bloques `image`.
  3. `runStructured` con `MODELS.smart` y esquema `FoodProfileProposal`.
  4. Reglas del prompt: no inventar restricciones; diferenciar `forbidden` de `limit`; ante "no puedo comer cebolla" **preguntar** por el resto de la familia `allium` (verdeo, puerro, echalote, ajo) en `open_questions` en lugar de asumir; ante un plan con números (gramos de carbohidratos, porciones), conservarlos; registrar `valid_until` si se menciona una duración; resumen en segunda persona y voseo.
  5. Guarda un `food_profile_drafts` pendiente y lo devuelve.
  6. `POST /api/food-profile/apply { draftId, edits? }` → valida, guarda `food_profiles` (versión + 1) y marca el draft como `applied`.
- **Aceptación:** con un audio tipo "no puedo comer cebolla y trato de comer pocas harinas" el draft trae la restricción `forbidden` de cebolla, un `limit` de harinas y una pregunta sobre el resto de la familia.

### T6.4 — UI "Mi alimentación"
- **Depende de:** T6.3
- **Archivos:** `app/(app)/perfil/alimentacion/page.tsx`, `components/food-profile/*`.
- **Pasos:**
  1. Si no hay perfil: intro cálida ("Contame cómo comés: qué te gusta, qué no podés comer, si seguís algún plan") + `VoiceRecorder` grande + "Prefiero escribir" + "Subir archivo" (PDF/foto del plan).
  2. Procesando → **revisión del draft:** resumen, lista de cambios (`+ agregado`, `~ cambiado`, `− quitado`) y preguntas abiertas como tarjetas que se contestan con chips (Sí/No) o voz/texto. Contestar vuelve a llamar a ingest con `answers`.
  3. "Guardar perfil" → apply.
  4. Con perfil: resumen editable, restricciones como chips (rojo = prohibido, ámbar = limitar) con ✕ y "+ agregar" manual (buscando en el catálogo de ingredientes y familias), objetivos, gustos, tiempos y equipamiento. Botón "Contame algo más" para sumar info por voz.
  5. "Mis fuentes": lista de audios/archivos/textos cargados, con "Borrar" (borra de Storage también).
  6. Disclaimer fijo: "Esto te ayuda a organizarte; no reemplaza el consejo de tu médico o nutricionista."
- **Aceptación:** de cero a perfil guardado en < 3 minutos hablando.

### T6.5 — Dominio: compatibilidad receta ↔ perfil
- **Depende de:** T6.2, T2.3
- **Archivos:** `lib/domain/compatibility.ts` + `compatibility.test.ts`.
- **Pasos:**
  1. `checkRecipe(recipeIngredients: { ingredientId, name, families, optional }[], restrictions) → { status: "ok" | "limit" | "forbidden" | "unknown", reasons: { ingredient, restriction, severity }[] }`.
  2. Match por `ingredient_id`, por familia (`type: family`), por categoría (mapa de categorías → familias, ej. `harinas` → `cereal_gluten`) y por texto normalizado como último recurso.
  3. Ingrediente **opcional** prohibido → `limit` con la razón "es opcional, sacalo".
  4. Ingredientes sin `ingredient_id` → aportan `unknown` (se muestra "revisar") salvo que matcheen por texto.
  5. `checkRecipeForGroup(recipe, diets[])` → resultado por persona.
  6. Tests: cebolla directa, verdeo con familia prohibida, verdeo con solo cebolla prohibida, opcional, desconocido, varias restricciones y prioridad (forbidden > limit > unknown > ok).
- **Aceptación:** cobertura del 100% de ramas en este archivo.

### T6.6 — Indicadores y filtro "apto para"
- **Depende de:** T6.5
- **Archivos:** `lib/recipes/compatibility.ts` (carga de datos), ajustes en `recipe-card`, `recipe-detail`, `filters`.
- **Pasos:**
  1. Cargar `get_group_diet` una vez por request y calcular la compatibilidad en el servidor.
  2. Card: avatares chiquitos con ✅/⚠️/⛔ por miembro con perfil.
  3. Detalle: bloque "Para quién va" con las razones ("Tiene cebolla de verdeo — Sofi no come cebolla"); ingredientes problemáticos resaltados en la lista.
  4. Filtro "Apta para…" (multi-selección de miembros) en la lista.
- **Aceptación:** las recetas con cebolla se ven ⛔ para quien la tiene prohibida y se ocultan con el filtro.

### T6.7 — Adaptar receta a un perfil
- **Depende de:** T6.6, T5.4
- **Archivos:** `app/api/ai/recipes/[id]/adapt/route.ts`, `lib/ai/prompts/adapt-recipe.ts`, botón en el detalle.
- **Pasos:**
  1. "Adaptar para…" (elige miembros) → `runStructured` (smart) con la receta + restricciones/objetivos → `RecipeDraft` adaptado con `changes[]` explicados ("reemplacé la cebolla por hinojo y apio").
  2. Validar el resultado con `checkRecipeForGroup`; si sigue con `forbidden`, un reintento con el problema; si persiste, error claro.
  3. Mostrar comparación original ↔ adaptada → "Guardar como variante" crea una receta nueva con `forked_from_recipe_id` = original y título "… (sin cebolla)".
- **Aceptación:** adaptar una receta con cebolla devuelve una variante ✅ para esa persona.

---

## Cierre de la Etapa 6
- [ ] Revisión de privacidad 🧠: nada del perfil, salvo restricciones y objetivos, es visible para otros.
- [ ] Prueba real: los dos cargan su perfil y revisan los indicadores de las recetas.

## Notas de ejecución

- T6.1: `food_profiles`, `food_profile_inputs` (con `kind` extra `'answer'` para las respuestas a preguntas abiertas) y `food_profile_drafts`: todo con RLS solo del propio usuario; bucket privado `profile-inputs` (carpeta por usuario, 15 MB). `get_group_diet(group)` es `security definer`, exige ser miembro y devuelve únicamente `restrictions` y `goals` de los miembros con perfil vigente (respeta `valid_until`); el resumen, las fuentes y los archivos nunca salen. 10 tests pgTAP, entre ellos que B lee las restricciones de A por la RPC pero no `food_profiles`/inputs/drafts, que C no obtiene nada, y que la RPC devuelve solo esas cuatro columnas.
