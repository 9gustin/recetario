# Etapa 14 — Nutricionistas: invitados, planes y seguimiento

**Resultado:** un profesional (nutricionista) entra con un código de invitación, crea planes con objetivos, los envía a un paciente (sin pisar su plan), y —si el paciente lo autoriza— ve su seguimiento (qué comió, si cargó o no).
**Origen:** idea de producto (12/11/2026). Datos de salud = sensibles: todo consentimiento explícito, revocable y con RLS estricta.

### [ ] T14.1 — Rol profesional y códigos de invitación
- **Pasos:** `profiles.is_professional` + `professional_invites` (código único, creado por admin vía script/consola, un uso o con cupo, vencimiento); `/profesionales` (landing pública: propuesta de valor, "Tengo un código"); alta con código → perfil profesional (nombre, matrícula opcional, bio); sin código no se accede a las herramientas profesionales.
- **Aceptación:** un código válido habilita el panel profesional; uno vencido o usado se rechaza; RLS + pgTAP.

### [ ] T14.2 — Planes del profesional (con objetivos)
- **Pasos:** `pro_plans`: título, objetivo (texto + tags: bajar de peso, masa muscular, etc.), duración, comidas por día con recetas del catálogo/propias o texto, notas y pautas; plantillas reutilizables; editor simple (reutiliza la UI de T13); puede armar con IA (borrador, validado por código) y asistir con restricciones del paciente solo si este las compartió.
- **Aceptación:** crear, editar y duplicar un plan como plantilla.

### [ ] T14.3 — Vínculo profesional ↔ paciente y envío
- **Pasos:** `pro_links` (profesional, paciente, estado: invitado/aceptado/revocado); el profesional invita por link/email; el paciente ve "Plan de <nombre>" en su bandeja y elige **"Agregar a mi plan"** (copia, nunca pisa), "Guardar solo recetas" o "Rechazar"; envío de **grupos de recetas** (colecciones) del catálogo sin necesidad de plan; notificación push/inbox.
- **Aceptación:** el paciente recibe, ve y acepta un plan; su plan actual queda intacto.

### [ ] T14.4 — Seguimiento con consentimiento
- **Pasos:** el paciente decide qué comparte (comidas registradas, adherencia, notas, peso opcional) y puede revocar en cualquier momento; el profesional ve histórico por día (qué cargó, qué siguió/cambió/salteó, días sin registro) y resumen semanal; RLS por vínculo aceptado + permisos; RPCs de lectura; registro de accesos; borrado al revocar o eliminar la cuenta.
- **Aceptación:** sin vínculo o con permiso revocado el profesional no ve nada (pgTAP); con vínculo ve el histórico compartido.

### [ ] T14.5 — Panel del profesional
- **Pasos:** lista de pacientes con estado (adherencia, último registro), vista de paciente (plan activo + seguimiento), plantillas, grupos de recetas enviados; mobile-first.
- **Aceptación:** flujo completo en e2e: código → crear plan → enviar → paciente acepta → carga comidas → profesional ve seguimiento.

### [ ] T14.6 — Legales, límites y cierre
- **Pasos:** texto de consentimiento y aviso ("herramienta de apoyo, no reemplaza criterio profesional"), términos para profesionales, límites de abuso (rate limit en invitaciones), `pnpm check`, `db:test`, `test:e2e`, build, `progreso.md`.
