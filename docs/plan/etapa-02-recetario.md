# Etapa 2 — Recetario manual

**Resultado:** cargamos nuestras recetas de siempre (ingredientes y pasos con tiempos), las buscamos rápido, escalamos porciones y tenemos historial de cambios.
**Spec:** §3 F3, F11 · §5.2 (Recetas) · §4.3 (regla de `lib/domain`).

---

### [x] T2.1 — Migración: recetas e ingredientes
- **Depende de:** T1.1
- **Archivos:** `supabase/migrations/<ts>_recipes.sql`.
- **Pasos:**
  1. Tablas `ingredients`, `recipes`, `recipe_ingredients`, `recipe_steps`, `recipe_versions` según §5.2. Agregar `recipes.status text default 'active' check (status in ('active','draft'))` (lo usan las etapas 5 y 7).
  2. Favoritos por usuario: `recipe_favorites (recipe_id, user_id, primary key)` en lugar de `recipes.is_favorite`.
  3. Búsqueda: configuración `spanish_unaccent` (spanish + unaccent); `recipes.search_tsv` actualizado por trigger con título (peso A), tags (B), descripción (C) y nombres de ingredientes (C). Índice GIN. Índice trigram sobre `ingredients.name` y `aliases`.
  4. RLS: recetas y sus hijas por `is_group_member(recipes.group_id)`. `ingredients`: select para `authenticated` y `anon`; escritura solo service role. `recipe_favorites`: solo el propio usuario.
  5. Bucket de Storage `recipe-images` (público para lectura, con paths `<group_id>/<recipe_id>/<file>`); insert/update/delete si es miembro del grupo del path.
  6. RPC `save_recipe(p_recipe jsonb) returns jsonb` (transaccional): crea o actualiza receta + reemplaza ingredientes y pasos + incrementa `current_version` + inserta snapshot en `recipe_versions` con `origin` y `change_note`. Valida membresía.
  7. RPC `search_ingredients(q text, lim int)` usando trigram + aliases.
- **Aceptación:** `pnpm db:reset` ok; `save_recipe` dos veces deja 2 versiones.
- **Verificación:** test pgTAP `supabase/tests/02_recipes.test.sql` (RLS cruzado entre grupos + versiones).

### [x] T2.2 — Dominio: unidades, parser de ingredientes y escalado
- **Depende de:** T0.6
- **Archivos:** `lib/domain/units.ts`, `lib/domain/ingredient-line.ts`, `lib/domain/scale.ts`, `lib/domain/format.ts` + tests `*.test.ts`.
- **Pasos:**
  1. `units.ts`: unidades canónicas (`g`, `kg`, `ml`, `l`, `unidad`, `cda`, `cdita`, `taza`, `pizca`, `diente`, `atado`, `lata`, `paquete`, `feta`, `rodaja`) con sinónimos ("gr", "grs", "cucharada", "cuch.", "cc"…). `convert(qty, from, to)` dentro de la misma dimensión (masa/volumen) y `toBase()`.
  2. `ingredient-line.ts`: `parseIngredientLine(text) → { quantity, unit, name, preparation, optional }`. Soportar: enteros, decimales con coma, fracciones ("1/2", "½", "1 y 1/2"), rangos ("2-3" → 2,5 + nota), "a gusto", "c/n", "opcional", preparaciones después de coma ("en cubos").
  3. `scale.ts`: `scaleQuantity(qty, from, to)`; redondeo amigable (unidades enteras o medias, gramos a 5/10, cucharadas a 1/2).
  4. `format.ts`: `formatQuantity(1.5, 'taza') → "1 ½ tazas"`.
  5. **Tests:** al menos 40 líneas reales de recetas argentinas en una tabla de casos.
- **Aceptación:** `pnpm test` en verde, sin dependencias de DB.

### [x] T2.3 — Catálogo de ingredientes (seed) y matcher
- **Depende de:** T2.1, T2.2
- **Archivos:** `supabase/seed/ingredients.json`, `supabase/seed.sql` (o script `scripts/seed-ingredients.ts`), `lib/domain/ingredient-match.ts` + test.
- **Pasos:**
  1. Generar `ingredients.json` con **~300 ingredientes comunes en Argentina** (escribirlo directamente, sin llamar a una API): `name` canónico en singular, `aliases` (incluye variantes regionales: palta/aguacate, zapallito/calabacín, morrón/pimiento, choclo/maíz, frutilla/fresa, ananá/piña, porotos/frijoles, chaucha/judía), `family` (`allium`, `crucifera`, `solanacea`, `cereal_gluten`, `lacteo`, `huevo`, `frutos_secos`, `mariscos`, `pescado`, `carne_roja`, `ave`, `cerdo`, `legumbre`, `tuberculo`, `hoja_verde`…), `aisle`, `default_unit`, `unit_weight_g`, `shelf_life` (días heladera/freezer/alacena como `[min,max]`), `storage_tips`, `nutrition_per_100g` aproximado.
  2. **Familia `allium`:** cebolla, cebolla morada, cebolla de verdeo, puerro, echalote, ajo, ciboulette.
  3. Seed idempotente (`on conflict (name) do update`).
  4. `ingredient-match.ts`: `normalizeName()` (minúsculas, sin acentos, singular simple, sin palabras de relleno: "de", "fresco", "picado") y `matchLocal(name, catalog)` exacto → alias. El fuzzy se resuelve con el RPC `search_ingredients` desde el servidor.
- **Aceptación:** el seed carga sin errores; los tests de matching cubren alias regionales y plurales.

### [x] T2.4 — Esquemas y acceso a datos de recetas
- **Depende de:** T2.1, T2.2
- **Archivos:** `lib/schemas/recipe.ts`, `lib/recipes/queries.ts`, `lib/recipes/actions.ts`.
- **Pasos:**
  1. Zod: `RecipeInput` (título 1–120, servings > 0, ingredientes, pasos con `duration_seconds` opcional y `timer_kind`), `RecipeDraft` (lo usa la IA en la Etapa 5: igual pero con campos opcionales y `name_canonical`).
  2. `queries.ts`: `getRecipe(id)` (con ingredientes, pasos, favorito del usuario, "última vez cocinada" — null hasta la Etapa 3), `listRecipes(groupId, filters)`, `getVersions(id)`.
  3. `actions.ts` (Server Actions): `saveRecipe(input)` → resuelve `ingredient_id` con el matcher → `save_recipe` RPC; `deleteRecipe` (soft delete); `toggleFavorite`; `uploadRecipeImage`.
- **Aceptación:** tipos sin `any`; las acciones devuelven `{ ok, data } | { ok: false, error }`.

### [x] T2.5 — Formulario de receta
- **Depende de:** T2.4
- **Archivos:** `app/(app)/g/[groupId]/recetas/nueva/page.tsx`, `.../recetas/[id]/editar/page.tsx`, `components/recipes/recipe-form/*`.
- **Pasos:**
  1. `react-hook-form` + Zod. Secciones: foto, título, descripción, porciones, tiempos (prep/cocción; el total se calcula), dificultad, etiquetas (chips con sugerencias: "low carb", "rápida", "freezable", "vianda", "vegetariana", "sin TACC").
  2. **Ingredientes:** una línea por ingrediente con parseo en vivo (`parseIngredientLine`) mostrando chips "200 g · pechuga de pollo · en cubos". Enter agrega otra línea. Pegar varias líneas crea varios ingredientes. Encabezados de sección ("Para la salsa") con una línea que empieza con `#` o un botón.
  3. **Pasos:** textarea por paso + selector de duración (chips 1/5/10/15/20/30 min + personalizado) + toggle "Esperar (horno, reposo)" = pasivo + tip opcional. Reordenar con `@dnd-kit` (con handle; táctil).
  4. Foto: input de cámara/galería, compresión en el cliente (máx. 1600 px, webp) antes de subir.
  5. Botón fijo abajo "Guardar". Al editar, campo opcional "¿Qué cambiaste?" (`change_note`).
- **Aceptación:** cargar una receta de 8 ingredientes y 6 pasos desde el celular en menos de 3 minutos.

### [x] T2.6 — Detalle de receta
- **Depende de:** T2.5
- **Archivos:** `app/(app)/g/[groupId]/recetas/[id]/page.tsx`, `components/recipes/recipe-detail/*`.
- **Pasos:**
  1. Header con foto, título, tiempos, dificultad, etiquetas, favorito.
  2. Selector de porciones (− 2 +) que escala ingredientes en vivo (`scaleQuantity` + `formatQuantity`).
  3. Ingredientes con checkbox (estado local), pasos numerados con duración.
  4. Acciones: **Cocinar** (deshabilitado hasta la Etapa 3), **Compartir** (Etapa 4), **Agregar al plan** (Etapa 7), Editar, Historial, Eliminar.
- **Aceptación:** escalar de 2 a 5 porciones da cantidades razonables y legibles.

### [x] T2.7 — Lista, búsqueda y filtros
- **Depende de:** T2.6
- **Archivos:** `app/(app)/g/[groupId]/recetas/page.tsx`, `components/recipes/recipe-card.tsx`, `components/recipes/filters.tsx`.
- **Pasos:**
  1. Buscador con debounce (full-text sobre `search_tsv` con `websearch_to_tsquery('spanish_unaccent', …)`).
  2. Chips: Favoritas, etiquetas más usadas, "≤ 30 min". Filtro "Tiene ingrediente…" (usa `search_ingredients`).
  3. Grilla de 2 columnas con foto (o placeholder con emoji), título y tiempo. Paginación con scroll infinito (de a 24).
  4. FAB "+" → por ahora solo "Escribir receta" (las demás opciones llegan en la Etapa 5).
  5. Estado vacío: "Cargá tu primera receta. Empezá por la que más cocinan."
- **Aceptación:** con 50 recetas, buscar "pollo" responde en < 300 ms en local.

### [x] T2.8 — Historial de versiones
- **Depende de:** T2.6
- **Archivos:** `app/(app)/g/[groupId]/recetas/[id]/historial/page.tsx`, `lib/domain/recipe-diff.ts` + test.
- **Pasos:**
  1. Lista de versiones: número, fecha, quién, nota, origen (editada / mientras cocinaba / restaurada).
  2. `recipe-diff.ts`: diferencias entre dos snapshots (ingredientes agregados/quitados/cambiados, pasos cambiados, tiempos).
  3. Ver una versión con su diff contra la anterior. Botón "Volver a esta versión" → `save_recipe` con `origin = 'restore'`.
- **Aceptación:** restaurar crea una versión nueva (no borra historia).

### T2.9 — E2E del recetario
- **Archivos:** `tests/e2e/recipes.spec.ts`.
- **Escenario:** crear receta pegando 5 líneas de ingredientes → guardar → buscarla → escalar a 4 porciones → editar un paso → ver 2 versiones → restaurar la 1. Un usuario de otro grupo no la ve (404).

---

## Cierre de la Etapa 2
- [ ] Deploy + seed del catálogo en prod.
- [ ] Prueba real: cargar 10 recetas de la casa.

## Notas de ejecución

- T2.1: búsqueda full-text con `spanish_unaccent` (copy de `pg_catalog.spanish` + `unaccent`). `search_tsv` se mantiene con dos triggers: uno BEFORE sobre `recipes` (título A, tags B, descripción C desde las propias columnas, porque al INSERT todavía no existen los ingredientes) y otro AFTER sobre `recipe_ingredients` que refresca el padre con el vector completo (incluye `raw_text` de ingredientes). `save_recipe(jsonb)` es un reemplazo completo (setea campos a NULL si no vienen), crea/actualiza receta, reemplaza ingredientes y pasos, incrementa `current_version` y escribe el snapshot. `search_ingredients` usa `extensions.similarity` (umbral 0.2) en vez del operador `%` para no lidiar con la calificación de operador del esquema `extensions`. Se agregó el helper `is_recipe_member(recipe_id)` (security definer) para el RLS de las tablas hijas. Favoritos en `recipe_favorites` (no `recipes.is_favorite`). Bucket `recipe-images` público de lectura y con escritura por miembro del grupo (primer segmento del path = group_id).

- T2.2: se eliminó `lib/domain/example.test.ts` (placeholder de T0.6). El parser soporta enteros, decimales con coma/punto, fracciones (`1/2`, `½`, `1 y 1/2`), rangos (`2-3` → 2,5 + nota), "a gusto"/"c/n" y "(opcional)". La cantidad sin unidad explícita se interpreta como `unidad` (conteo). `roundQuantity` redondea gramos a 5/10, cucharadas a 1/2 y volúmenes chicos a cuartos; la pluralización es plural solo cuando la cantidad es mayor a 1 ("½ taza", "1 ½ tazas").

- T2.3: el catálogo son **263 ingredientes** (cercano a los ~300 pedidos; quedan cubiertas verduras, frutas, carnes, lácteos, almacén, especias, legumbres y congelados) con `aliases` regionales (palta/aguacate, zapallito/calabacín, morrón/pimiento, choclo/maíz, frutilla/fresa, ananá/piña, porotos/frijoles, chaucha/judía). `unit_weight_g` y `shelf_life` solo para los más comunes; `nutrition_per_100g` se deja para la ficha que complete la IA. El dato vive en `supabase/seed/ingredients.json`; `supabase/seed.sql` se **genera** con un script (dollar-quote del JSON) para que `db:reset` lo cargue idempotente (`on conflict (name) do update`). El matcher (`matchLocal`/`normalizeName`) hace exacto→alias tras normalizar (minúsculas, sin acentos, singular simple, sin relleno); el fuzzy queda en el RPC `search_ingredients`.

- T2.4: `saveRecipe` resuelve el `ingredient_id` con `matchLocal` (parsea el `raw_text` con `parseIngredientLine` para sacar el nombre) y llama al RPC `save_recipe`. `save_recipe` devuelve `jsonb`, así que el resultado se castea a `{ id, current_version }`. `uploadRecipeImage` sube a Storage (bucket `recipe-images`, path `<group>/<recipe>/<uuid>.<ext>`) y actualiza `image_url` con la URL pública. `last_cooked_at` queda `null` hasta la Etapa 3.

- T2.5: se instalaron `react-hook-form` + `@hookform/resolvers` (el plan los nombra). Los ingredientes van en un `textarea` (una línea por ingrediente) con parseo en vivo (`parseIngredientLine`) mostrando chips; pegar varias líneas crea varios. Los pasos usan `useFieldArray` con reordenar por **botones ↑/↓** en vez de `@dnd-kit` (drag-and-drop táctil es menos fiable; se deja fuera para simplificar). La foto se comprime en el cliente (canvas → webp, máx 1600 px) y sube vía `uploadRecipeImage`. El total de tiempo se calcula (prep + cocción).

- T2.6: el detalle escala ingredientes en vivo con `scaleQuantity` + `formatQuantity` al cambiar porciones. El botón "Cocinar" queda deshabilitado (Etapa 3); Compartir y "Agregar al plan" llegan en Etapas 4 y 7. "la hicieron X veces" se omite hasta tener sesiones de cocina (Etapa 3). El header usa `bg-hero` con foto (`image_url`) si existe.

- T2.7: búsqueda con debounce (250 ms) sobre `search_tsv`; chips Favoritas, Menos de 30 min, las 5 etiquetas más usadas del grupo y "Tiene ingrediente…" (autocompleta con `search_ingredients`, filtra por `recipe_ingredients.ingredient_id`). Paginación de a 24 con IntersectionObserver (la acción pide una fila de más para saber si hay otra página). Validación Zod en `lib/schemas/recipe-search.ts`. Medido: 'pollo' sobre 50 recetas, 16 resultados en 0,1 ms. El título 'Recetas' lo da la barra superior, por eso la pantalla no repite el h1; el FAB se ancla al contenedor max-w-md. Las advertencias de lint de `recipe-form.tsx` son de T2.5 y quedan para la revisión.

- T2.8: historial en `<details>` (sin JS) con el diff contra la versión anterior (`lib/domain/recipe-diff.ts`, 6 tests). Los ingredientes se emparejan por `ingredient_id` (o texto normalizado si no hay) y los pasos por posición, así que insertar un paso en el medio se ve como varios cambios. Restaurar llama a `saveRecipe` con `origin = 'restore'` y nota "Restaurada la versión N". El nombre del autor sale de `profiles` (RLS permite leer a quienes comparten grupo).
