# Etapa 12 — Catálogo y sitio público

**Resultado:** una base grande de recetas rápidas (generadas con IA, originales) disponible para todos; un sitio público sin login para buscar (sin IA, para que sea barato) y ver recetas, colecciones y planes que la gente decide hacer públicos; la IA del plan sugiere desde tus recetas primero y después desde el catálogo.
**Decisiones (12/11/2026):** fuente = generación con IA (sin copiar recetarios con copyright); se puede hacer público: recetas, colecciones, planes semanales; buscador público.

### [x] T12.1 — Modelo de datos público
- **Pasos:** `recipes.visibility ('private'|'public')`, `recipes.slug` único, `recipes.is_catalog`; grupo del sistema "Catálogo" (solo lectura para usuarios); `recipe_collections` + `recipe_collection_items` (visibility, slug); `plan_shares` (plan publicado como plantilla: comidas sin datos personales); RLS con lectura anónima solo de lo público; índices de búsqueda; pgTAP.
- **Aceptación:** `anon` lee recetas/colecciones/planes públicos y nada privado.

### [x] T12.2 — Generador del catálogo con IA
- **Pasos:** `scripts/catalog/generate.ts` por lotes (categorías × tiempo × cocina: rápidas, desayunos, almuerzos, cenas, vegetarianas, sin gluten, de olla, airfryer, meriendas, salsas, postres simples…); salida validada con Zod y con `lib/domain` (unidades, ingredientes vinculados al catálogo); deduplicación por título/ingredientes; tags, tiempos y `storage_info`; carga idempotente al grupo Catálogo; informe de costo.
- **Aceptación:** ≥ 500 recetas únicas cargadas, todas con ingredientes y pasos válidos.

### [x] T12.3 — Sitio público de exploración
- **Pasos:** rutas públicas sin login: `/explorar` (búsqueda de texto + filtros de tiempo, tags, ingrediente; paginada; sin IA), `/receta/[slug]` (SEO, JSON-LD, OG), `/coleccion/[slug]`, `/plan-publico/[slug]`; "Guardar en mi recetario" (pide login y copia); sitemap y robots.
- **Aceptación:** e2e sin sesión: buscar, abrir una receta y ver que pide login solo para guardar.

### [x] T12.4 — Hacer público
- **Pasos:** switch "Hacer pública" en cada receta; colecciones (crear, agregar recetas, hacer pública); publicar un plan semanal como plantilla; copiar un plan público a mi grupo; revocar.
- **Aceptación:** una receta pública aparece en `/explorar`; al despublicarla desaparece.

### [x] T12.5 — Catálogo en la app y en la IA
- **Pasos:** en Recetas y al agregar al plan, primero "Tus recetas" y después "Del catálogo" (con botón "Guardar"); tool `search_catalog` para el agente del plan, "¿Qué tenés?" e Ideas (siempre priorizando las del grupo); partir de una receta del catálogo ("Usar como base" la copia para editar).
- **Aceptación:** "armame la semana" en un grupo sin recetas propias usa recetas del catálogo.

### [ ] T12.6 — E2E y cierre
- **Pasos:** e2e del sitio público y de publicar/despublicar; `pnpm check`, `db:test`, `test:e2e`, build; marcar la etapa en `progreso.md`.

- T12.1: La lectura pública es solo por RPC (security definer); las tablas siguen cerradas para anon. Publicar una colección o un plan publica sus recetas. Orden de búsqueda: comunidad primero, catálogo después.

- T12.2: 548 recetas generadas con Sonnet 5.5 (≈ US$ 12 de API; 59 pedidos en scripts/catalog/briefs.ts × ~10), validadas por código (parser de ingredientes, tiempos, tags) y deduplicadas por título. Datos en data/catalog/batches (versionados) y cargables con `pnpm catalog:load`. Ampliar: agregar pedidos y correr `pnpm catalog:generate`.
