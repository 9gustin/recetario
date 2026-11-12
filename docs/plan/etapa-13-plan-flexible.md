# Etapa 13 — "Mis comidas": un listado simple, sin días ni horarios

**Resultado:** la persona entra, dice (por audio o texto) lo que quiere comer — "tarta de pollo, tarta de espinaca, pollo con ensalada ×3, sugerime ensaladas, carne con puré en olla" — y se arma un **listado de comidas** (un stock para cocinar cuando quiera), con un resumen breve y, más abajo, la **lista de compras resumida por categorías**. Todo se guarda solo: sin "aprobar", sin día/hora.
**Origen:** feedback de prueba real (12/11/2026): el plan semanal es forzado y complejo; la lista de compras es enorme.

### [x] T13.1 — Planes por rango (base)
- Hecho: `meal_plans.end_date` (1–14 días), UI con "Un día / 3 días / Una semana", momento elegible al agregar. Queda como base; la T13.2 lo simplifica aún más.

### [ ] T13.2 — Modelo "listado de comidas"
- **Pasos:** `meal_plan_entries.date` y `slot` pasan a ser opcionales (comida sin fecha = "para cocinar"); `quantity` (veces que se hace, ej. ×3); `cooked_at` para tildar lo que ya se cocinó; un único "menú" vigente por grupo (se crea solo al agregar la primera comida; sin estado borrador/aprobado en la UI); `approve_plan` pasa a ser automático (recetas nuevas de la IA se guardan al agregarlas); migración + pgTAP; compat con planes viejos y con "Hoy".
- **Aceptación:** agregar comidas sin fecha ni momento; las existentes con fecha siguen funcionando.

### [ ] T13.3 — Pantalla "Mis comidas" simple
- **Pasos:** reemplaza el tablero semanal: tarjetas compactas (foto, título, ×N, tilde "cocinada"); agregar por voz/texto/receta/catálogo; quitar el flujo "Aprobar plan"; fecha opcional dentro de cada comida ("Asignar día"), no obligatoria; resumen corto arriba ("7 comidas · 12 ingredientes para comprar").
- **Aceptación:** de cero a una lista de 3 comidas en ≤ 3 toques o con un audio.

### [ ] T13.4 — IA conversacional que arma el listado
- **Pasos:** el agente recibe pedidos libres ("pollo con ensalada 3 veces, sugerime ensaladas"), agrega comidas sin día/hora, sugiere opciones (catálogo/recetario) y responde con un resumen breve; entrada por audio (transcripción existente); todo se guarda por defecto, sin confirmaciones; los cambios son visibles y reversibles ("deshacer").
- **Aceptación:** un audio con 5 pedidos crea 5+ comidas; `eval:plan` actualizado.

### [ ] T13.5 — Lista de compras resumida y por categorías
- **Pasos:** debajo del listado, lista de compras automática (se regenera sola al cambiar las comidas); agrupada por lugar/categoría (verdulería, carnicería/pollería, almacén/súper, lácteos, otros); sección final colapsada "Cosas que seguro tenés" (aceite, sal, azúcar, especias…) con tilde para ignorar; cantidades redondeadas y agrupadas; editable (tildar, agregar, quitar).
- **Aceptación:** la lista de un menú de 7 comidas cabe en ~2 pantallas y los básicos quedan al final.

### [ ] T13.6 — E2E y cierre
- **Pasos:** ajustar e2e de plan/compras/hoy; `pnpm check`, `db:test`, `test:e2e`, build; `progreso.md`.
