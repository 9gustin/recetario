# Etapa 13 — Plan flexible ("lo que voy a comer")

**Resultado:** planificar deja de ser "armar toda la semana". Se puede anotar una sola comida, unos pocos días o la semana entera, solo con las comidas que la persona quiere (sin obligar desayuno/merienda/etc.), y ver enseguida qué hay que comprar.
**Origen:** feedback de prueba real (12/11/2026): "el plan está muy forzado semanalmente… algo más tranqui: voy a comer esto y qué necesito comprar; 3 días, una semana, según el tiempo".

### [ ] T13.1 — Rango y comidas opcionales (datos)
- **Pasos:** `meal_plans` pasa de "semana" a "rango": `start_date`, `end_date` (la semana sigue siendo un caso; migración que rellena desde `week_start`); `slots` activos por plan (ej. solo almuerzo y cena); índice único por grupo+rango sin solapar planes activos; actualizar `duplicate_plan`, `finalize`, validaciones y tipos; pgTAP.
- **Aceptación:** crear un plan de 3 días con solo almuerzo y cena; los planes de semana existentes siguen andando.

### [ ] T13.2 — Interfaz "Mi comida" simple
- **Pasos:** pantalla Plan con vista por días (no grilla obligatoria): "Agregar comida" (receta propia, catálogo o texto libre) a un día/momento; sin plan formal previo (se crea un plan implícito); selector de rango al empezar ("Hoy", "3 días", "Semana", "Elegir fechas"); momentos del día opcionales (se muestran solo los que tienen algo o que se activan); estado vacío amable.
- **Aceptación:** desde cero, en ≤ 3 toques se agrega una comida y se ve "Qué comprar".

### [ ] T13.3 — "Qué necesito comprar" inmediato
- **Pasos:** botón fijo "Qué comprar" en el plan que arma/actualiza la lista de compras del rango en vivo (sin pasos de "finalizar"); la finalización (storage-info, prep) pasa a ser opcional y en segundo plano.
- **Aceptación:** agregar una receta al plan actualiza la lista de compras sin pantallas intermedias.

### [ ] T13.4 — IA con rango y comidas elegidas
- **Pasos:** el agente del plan y el chat preguntan/deducen rango y momentos ("armame 3 cenas"); prompt y `validatePlan` aceptan rangos y slots parciales; sugerencias "completar lo que falta".
- **Aceptación:** "armame almuerzos para 3 días" crea solo eso; eval `eval:plan` con casos de rango parcial.

### [ ] T13.5 — E2E y cierre
- **Pasos:** e2e de plan de 1 día y de 3 días; ajustar e2e existentes de plan/semana; `pnpm check`, `db:test`, `test:e2e`, build; `progreso.md`.
