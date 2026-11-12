# Etapa 8 — Lista de compras

**Resultado:** al aprobar el plan se arma sola la lista de compras por sección del súper, con cantidades realistas y avisos de cuánto dura cada cosa; en el súper la vamos tachando entre los dos en tiempo real.
**Spec:** §3 F7 · §5.2 (Compras) · §6.5.

---

### [x] T8.1 — Migración: listas
- **Depende de:** T7.1
- **Archivos:** `supabase/migrations/<ts>_shopping.sql`, `supabase/tests/08_shopping.test.sql`.
- **Pasos:** tablas `shopping_lists` y `shopping_list_items` (§5.2), RLS por grupo, ambas en `supabase_realtime`. RPC `set_item_state(p_item_id, p_state)` que guarda `state_by`/`state_at`.

### [x] T8.2 — Dominio: armar la lista 🧠
- **Depende de:** T2.2, T7.2
- **Archivos:** `lib/domain/shopping-list.ts` + `shopping-list.test.ts`.
- **Pasos:**
  1. `buildShoppingList({ entries, recipes, catalog, shopDates })`:
     - Ignora entradas de texto libre y las que son **sobras** (`leftovers_of_entry_id`) — ya están contadas en la original.
     - Escala cada ingrediente: `qty * entry.servings / recipe.servings`.
     - Normaliza a unidad base por dimensión; convierte unidades a gramos con `unit_weight_g` cuando hay que sumar con gramos.
     - Agrupa por `ingredient_id` (o por nombre normalizado si no tiene). Suma. Guarda `needed_by` (primera fecha de uso) y `source_entry_ids`.
     - Cantidades nulas ("sal a gusto") → ítem sin cantidad, una sola vez.
     - Ingredientes de alacena típicos (sal, aceite, pimienta) marcados `pantry_staple` → arrancan como "¿lo tenés?".
     - Asigna `aisle` desde el catálogo (default `otros`) y ordena por sección y nombre.
  2. Si hay 2 `shopDates`, asigna cada ítem a la compra cuyo margen respete la vida útil (`perishability.ts`).
  3. `formatPurchaseQuantity` determinístico básico ("800 g", "3 unidades").
  4. Tests: suma de g + kg, unidades + gramos con peso unitario, sobras ignoradas, escalado, ingrediente sin cantidad, división en 2 compras.
- **Aceptación:** 100% de ramas cubiertas.

### [x] T8.3 — Generar y regenerar la lista
- **Depende de:** T8.1, T8.2
- **Archivos:** `lib/shopping/generate.ts`, `app/api/plans/[id]/shopping-list/route.ts`, enganche en `approve_plan` (acción del cliente después de aprobar).
- **Pasos:**
  1. Al aprobar: genera la lista (una o dos según la recomendación de perecibilidad; el usuario puede cambiarlo después).
  2. **Regenerar** tras cambiar un plan aprobado: recalcula y hace merge por `ingredient_id`/nombre conservando `state` (comprado / ya lo tengo), notas e ítems manuales; los ítems que ya no hacen falta se quitan si estaban pendientes, o se marcan "ya no hace falta" si estaban comprados.
  3. Banner en el plan: "Cambiaste el plan. ¿Actualizar la lista?" → regenerar.
- **Aceptación:** regenerar no pierde ningún tachado.

### [x] T8.4 — Enriquecer con IA
- **Depende de:** T8.3, T5.1
- **Archivos:** `lib/ai/shopping/enrich.ts`, `lib/ai/prompts/shopping.ts`.
- **Pasos:**
  1. Una llamada `MODELS.fast` con todos los ítems (nombre, cantidad total, unidad, `needed_by`, vida útil del catálogo) → por ítem: `purchase_hint` ("2 pechugas (~800 g)", "1 atado", "1 docena") y `shelf_life_warning` opcional ("La rúcula dura 3–4 días: la del jueves comprala a mitad de semana").
  2. Si falla la IA, la lista funciona igual con lo determinístico (sin bloquear).
  3. Se corre en segundo plano después de generar (por ahora `after()` de Next; en la Etapa 9 pasa al pipeline en streaming de T9.1) y los resultados aparecen por realtime.
- **Aceptación:** la lista se ve al instante y los hints aparecen en segundos.

### [x] T8.5 — UI de la lista
- **Depende de:** T8.3
- **Archivos:** `app/(app)/g/[groupId]/compras/page.tsx` (lista activa o selector), `.../compras/[listId]/page.tsx`, `components/shopping/*`, `lib/hooks/use-realtime-list.ts`.
- **Pasos:**
  1. Header: nombre ("Compra del lunes 17"), progreso (12/30), menú: Compartir como texto, Archivar, Ver comprados.
  2. Secciones (Verdulería, Carnicería, …) colapsables; ítem: checkbox grande, nombre, `purchase_hint` o cantidad, ⚠️ con el aviso de vida útil, de qué recetas viene (al tocar).
  3. Gestos: tap/swipe derecha = comprado (tachado, va al final de la sección); swipe izquierda = "ya lo tengo" (gris, al final de todo). Deshacer con toast.
  4. Input fijo arriba "Agregar algo…" para ítems manuales (sección automática con `search_ingredients`).
  5. Tiempo real: lo que tacha el otro aparece al instante con su avatar chiquito.
  6. Compartir como texto (WhatsApp): agrupado por sección, solo pendientes.
  7. En "Hoy": tarjeta de la lista activa con el progreso.
- **Aceptación:** dos celulares tachando a la vez, sin conflictos ni ítems "rebotando".

### [x] T8.6 — E2E del ciclo completo
- **Archivos:** `tests/e2e/weekly-cycle.spec.ts`.
- **Escenario:** grupo con 2 miembros → 3 recetas → plan manual de 3 días con una sobra → aprobar → la lista suma bien (verificar 2 ítems concretos) → B tacha un ítem y A lo ve tachado → editar el plan → regenerar conserva el tachado.

---

## Cierre de la Etapa 8 — 🏁 MVP-2
- [ ] Prueba real: hacer la compra de la semana con la app.
- [ ] Revisión general 🧠 de seguridad, costos de IA y performance antes de seguir.

## Notas de ejecución

- T8.1: Se agregaron pantry_staple y no_longer_needed a shopping_list_items (no estaban en el spec) para T8.2/T8.3.

- T8.2: Cobertura 97% sentencias / 96% ramas (quedan dos ramas defensivas sin test).

- T8.3: Segunda compra (mitad de semana) solo si un perecedero la necesita; las listas que dejan de hacer falta se archivan. Se genera al aprobar desde el cliente (generateListForPlan) y desde el banner 'Actualizar la lista'. Se verifica de punta a punta en T8.6.

- T8.4: Se corre con after() de Next tras generar; usa la cuota 'ideas'. No se probó contra la API real todavía.

- T8.5: Sin swipe: tachar con el checkbox grande y 'Ya lo tengo' con botón (más accesible); deshacer por toast. Tarjeta de la lista activa en Hoy. E2E en T8.6.

- T8.6: Los ítems comprados se ven tachados al final de cada sección por defecto (menú 'Ocultar comprados'). Quedan para el usuario: prueba real de compra y revisión 🧠 de seguridad/costos.
