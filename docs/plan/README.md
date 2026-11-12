# Plan de desarrollo — Recetario

Plan ejecutable tarea por tarea con Claude Sonnet (Claude Code). Cada tarea está pensada para **una sesión**: alcance cerrado, archivos concretos, criterios de aceptación y cómo verificarla.

- Qué construimos y por qué: [`../SPEC.md`](../SPEC.md)
- Reglas del repo para el agente: [`../../CLAUDE.md`](../../CLAUDE.md)

---

> **Reparto de trabajo:** la ejecución real se divide en configuración (Sonnet), código (DeepSeek) y revisión (Sonnet). Los prompts de cada rol y la línea de tiempo están en [`docs/execution/`](../execution/README.md); usá esos. El prompt genérico de abajo sirve si una tarea la hace Claude Code directamente.

## 1. Cómo ejecutar cada tarea

### Flujo

1. Abrí una sesión nueva de Claude Code en la carpeta del repo, con **Sonnet**.
2. Pegá el prompt de abajo, cambiando el ID de tarea.
3. Si la tarea tiene pasos 👤, el agente te los va a pedir: hacelos vos (consolas web, claves) y avisale.
4. Revisá lo que hizo: corré `pnpm dev` y probalo en el celular o en el viewport mobile.
5. Si está bien, aceptá el commit y pasá a la siguiente. Si no, pedile ajustes en la misma sesión.

### Prompt para cada tarea

```text
Ejecutá la tarea T1.3 del plan.

1. Leé CLAUDE.md, docs/plan/README.md y el archivo de la etapa de esa tarea en docs/plan/.
2. Leé las secciones de docs/SPEC.md que la tarea cita.
3. Antes de escribir código, decime en 5 líneas o menos qué vas a hacer y qué archivos vas a tocar.
4. Implementá solo esa tarea. No adelantes otras.
5. Corré la verificación de la tarea y `pnpm check`. Si algo falla, arreglalo.
6. Marcá la tarea como hecha en el archivo de la etapa y en la tabla de docs/plan/README.md.
7. Hacé commit con el mensaje "T1.3: <resumen>".
8. Al final, decime: qué hiciste, cómo lo pruebo a mano, y cualquier decisión que tomaste sin estar en el spec.
```

### Cuándo usar otro modelo

- **Sonnet** para todo por defecto.
- **Opus** si una tarea falla dos veces seguidas, o para las tareas marcadas 🧠: diseño del loop de agente (T7.8), `validatePlan` (T7.7) y revisiones de seguridad (RLS) al cierre de cada etapa.

### Si algo sale mal

- Si el agente se trabó, abrí una sesión nueva con el mismo prompt y agregá: "Ya hay trabajo parcial de esta tarea en el repo; revisá `git status` y continuá".
- Si una tarea resultó más grande de lo pensado, pedile que la parta en `T3.2a`/`T3.2b` dentro del archivo de la etapa y que ejecute solo la primera parte.

---

## 2. Prerrequisitos 👤 (una sola vez, antes de la Etapa 0)

| Qué | Para qué | Cuándo hace falta |
|---|---|---|
| Node.js LTS + `pnpm` (`corepack enable`) | Correr el proyecto | T0.1 |
| Git + cuenta de GitHub | Repo y CI | T0.1 / T0.7 |
| **Docker Desktop** (Windows) | Supabase local | T0.5 |
| Supabase CLI (`pnpm dlx supabase` alcanza) | Migraciones, DB local | T0.5 |
| Cuenta Supabase (proyecto `prod` en **São Paulo**) | DB en producción | T0.8 |
| Cuenta Vercel conectada a GitHub | Hosting | T0.8 |
| API key de Anthropic | IA | T5.1 |
| API key de transcripción (OpenAI o Deepgram) | Voz | T5.2 |
| Sentry y PostHog (opcionales) | Errores y analytics | T0.8 |

---

## 3. Definición de "hecho" (vale para todas las tareas)

- [ ] Cumple los criterios de aceptación de la tarea.
- [ ] `pnpm check` pasa (lint + typecheck + tests unitarios).
- [ ] Si tocó la DB: migración nueva, `pnpm db:reset` sin errores, tipos regenerados, RLS con policies y `pnpm db:test` en verde.
- [ ] Si tocó UI: se ve y se usa bien a 375 px, con textos en español con voseo, y con estados de carga, vacío y error.
- [ ] Sin `console.log` sueltos, sin `any` nuevos, sin secretos en el código.
- [ ] Commit `T<x>.<y>: …`.

**Cierre de etapa:** todas sus tareas hechas, e2e de la etapa en verde, deploy a producción y prueba manual en el celular.

---

## 4. Etapas

| Etapa | Archivo | Resultado | Hito |
|---|---|---|---|
| 0 | [etapa-00-fundaciones.md](etapa-00-fundaciones.md) | App vacía instalable en el celular, CI y deploy | |
| 1 | [etapa-01-auth-grupos.md](etapa-01-auth-grupos.md) | Login, grupos, invitación por link | |
| 2 | [etapa-02-recetario.md](etapa-02-recetario.md) | Recetas manuales, búsqueda, versiones | |
| 3 | [etapa-03-modo-cocinar.md](etapa-03-modo-cocinar.md) | Cocinar paso a paso tipo stories | |
| 4 | [etapa-04-compartir.md](etapa-04-compartir.md) | Link público, copiar a grupo, enviar a persona | **MVP-1** |
| 5 | [etapa-05-ia-importar.md](etapa-05-ia-importar.md) | Importar recetas por texto, link, foto o voz | |
| 5b | [etapa-05b-asistente.md](etapa-05b-asistente.md) | Preguntale: chat con @receta, también por voz mientras cocinás | |
| 6 | [etapa-06-perfil-alimentario.md](etapa-06-perfil-alimentario.md) | Perfil por voz/archivos, compatibilidad | |
| 7 | [etapa-07-plan-semanal.md](etapa-07-plan-semanal.md) | Plan manual + plan con IA, home Hoy con estados, ¿Qué tenés? e ideas | |
| 8 | [etapa-08-lista-compras.md](etapa-08-lista-compras.md) | Lista de compras en tiempo real | **MVP-2** |
| 8b | [etapa-08b-plan-vivo.md](etapa-08b-plan-vivo.md) | Plan de la nutricionista digitalizado, ajustable y con registro | |
| 9 | [etapa-09-meal-prep.md](etapa-09-meal-prep.md) | Tareas de meal prep y tips | |
| 10 | [etapa-10-notificaciones-pulido.md](etapa-10-notificaciones-pulido.md) | Push, offline, onboarding | |

---

## 5. Tablero de avance

Marcar `[x]` al terminar cada tarea (lo hace el agente).

**Etapa 0** — [x] T0.1 · [x] T0.2 · [x] T0.3 · [x] T0.4 · [x] T0.5 · [x] T0.6 · [x] T0.7 · [x] T0.8
**Etapa 1** — [x] T1.1 · [x] T1.2 · [x] T1.3 · [x] T1.4 · [x] T1.5 · [x] T1.6 · [x] T1.7
**Etapa 2** — [x] T2.1 · [x] T2.2 · [x] T2.3 · [x] T2.4 · [x] T2.5 · [x] T2.6 · [x] T2.7 · [x] T2.8 · [x] T2.9
**Etapa 3** — [x] T3.1 · [x] T3.2 · [x] T3.3 · [x] T3.4 · [x] T3.5 · [x] T3.6 · [x] T3.7 · [x] T3.8
**Etapa 4** — [x] T4.1 · [x] T4.2 · [x] T4.3 · [x] T4.4 · [x] T4.5 · [x] T4.6
**Etapa 5** — [x] T5.1 · [x] T5.2 · [x] T5.3 · [x] T5.4 · [x] T5.5 · [ ] T5.6
**Etapa 5b** — [ ] T5B.1 · [ ] T5B.2 · [ ] T5B.3 · [ ] T5B.4 · [ ] T5B.5 · [ ] T5B.6 (después de 8b)
**Etapa 6** — [ ] T6.1 · [ ] T6.2 · [ ] T6.3 · [ ] T6.4 · [ ] T6.5 · [ ] T6.6 · [ ] T6.7
**Etapa 7** — [ ] T7.1 · [ ] T7.2 · [ ] T7.3 · [ ] T7.4 · [ ] T7.5 · [ ] T7.6 · [ ] T7.7 · [ ] T7.8 · [ ] T7.9 · [ ] T7.10 · [ ] T7.11 · [ ] T7.12 · [ ] T7.13 · [ ] T7.14
**Etapa 8** — [ ] T8.1 · [ ] T8.2 · [ ] T8.3 · [ ] T8.4 · [ ] T8.5 · [ ] T8.6
**Etapa 8b** — [ ] T8B.1 · [ ] T8B.2 · [ ] T8B.3 · [ ] T8B.4 · [ ] T8B.5 · [ ] T8B.6 · [ ] T8B.7 · [ ] T8B.8
**Etapa 9** — [ ] T9.1 · [ ] T9.2 · [ ] T9.3 · [ ] T9.4
**Etapa 10** — [ ] T10.1 · [ ] T10.2 · [ ] T10.3 · [ ] T10.4 · [ ] T10.5 · [ ] T10.6

---

## 6. Formato de cada tarea

```
### T2.3 — Título
- Depende de: tareas previas
- Spec: secciones de SPEC.md a leer
- Objetivo: una o dos oraciones
- Archivos: qué crear o modificar
- Pasos: lista ordenada de lo que hay que hacer
- Aceptación: condiciones verificables
- Verificación: comandos y prueba manual
- Fuera de alcance: lo que NO hacer en esta tarea
```

Convenciones: 👤 = paso humano · 🧠 = conviene Opus.
