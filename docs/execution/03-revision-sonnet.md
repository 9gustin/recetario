# 03 · Revisión y pruebas — instrucciones para Claude Sonnet

> Este archivo es tu guía completa. Cada vez que te llaman, leé `docs/execution/progreso.md` para saber qué revisar y seguí estas instrucciones de principio a fin.

## Objetivo final

Que cada etapa que DeepSeek termina quede **probada, revisada, arreglada, mergeada a `main` y desplegada en producción**, y que al terminar la última etapa la app completa pase una **revisión general** que la deje lista para usar en casa.

Concretamente, al terminar cada llamada tiene que ser verdad que:
1. Toda etapa marcada "lista para revisión" en `progreso.md` tiene su informe en `docs/reviews/etapa-XX.md` y está **revisada** (o **bloqueada**, con el motivo).
2. Lo revisado está mergeado de `dev` a `main`, con CI en verde, migraciones aplicadas en producción y deploy funcionando.
3. Si ya están todas las etapas, existe `docs/reviews/final.md` con la revisión general.

---

## Cómo arranca cada llamada

1. `cd ~/projects/recetario && git fetch && git checkout dev && git pull`.
2. Leé: `CLAUDE.md`, este archivo, `docs/execution/progreso.md`, `docs/execution/02-codigo-deepseek.md` (para saber qué reglas siguió DeepSeek y qué diseño corresponde a cada tarea), `docs/design/README.md` y `docs/SPEC.md` (completo la primera vez; después, las secciones que citen las tareas).
3. Armá la lista de etapas a revisar: las marcadas "lista para revisión" en `progreso.md` que no tienen "revisada". Revisalas **en orden**.
4. Si no hay ninguna: si las Etapas 1 a 10 están todas revisadas y no existe `docs/reviews/final.md`, hacé la **revisión general** (§B). Si no, decí que no hay nada para revisar y qué está haciendo DeepSeek según `progreso.md`.

---

## A. Revisión de una etapa

Para cada etapa a revisar (archivo `docs/plan/etapa-XX-*.md`):

### 1. Preparar
1. `pnpm install`, `pnpm db:start`, `pnpm db:reset`, `pnpm db:types` → no tiene que haber cambios en los tipos sin commitear.
2. `git log main..dev --oneline` y `git diff main...dev --stat` para ver qué entró.

### 2. Pruebas automáticas
`pnpm check`, `pnpm db:test`, `pnpm test:e2e`, `pnpm build`. Anotá cada resultado.

### 3. Criterios de aceptación
Para cada tarea de la etapa: leé sus criterios de "Aceptación" y verificá cada uno, leyendo el código y probándolo. Anotá cumplido / no cumplido con la evidencia.

### 4. Probar la app como usuario
1. Levantá `pnpm dev` y abrí la app en el navegador con viewport de celular **390 × 844**.
2. Recorré el flujo principal de la etapa como lo haría la persona (para flujos de grupo, con dos usuarios en dos contextos). Usuarios de prueba: creados con el cliente admin solo en local.
3. Hacelo en los **tres temas** (forzando mediodía / tarde / noche desde la preferencia de Perfil o la cookie).
4. Sacá capturas de las pantallas principales.

### 5. Diseño
1. Compará cada pantalla con su archivo de `docs/design/pantallas/` (tabla de `docs/design/README.md` §2): estructura, jerarquía, tamaños de letra, espaciados, botón principal, barra inferior.
2. `grep -rnE "#[0-9A-Fa-f]{6}" app components` → no puede haber hex fuera de `app/globals.css`.
3. Textos en español con voseo; estados de carga, vacío y error presentes.

### 6. Código
Revisá el diff de la etapa buscando: lógica de negocio fuera de `lib/domain`, `any`, errores sin manejar, consultas repetidas (N+1), componentes duplicados, dependencias que el plan no nombra, cambios fuera del alcance de las tareas, tests débiles o que no prueban lo que dicen.

### 7. Seguridad
- Toda tabla nueva con RLS y policies; tests pgTAP que prueban acceso cruzado entre grupos.
- Funciones `security definer` con `set search_path = public` y chequeo de permisos adentro.
- Cliente admin solo donde el plan lo indica.
- Zod en cada Server Action y Route Handler.
- Nada de claves en el repo (`git grep -nE "sk-|eyJhbGci|ANTHROPIC_API_KEY=."`).
- Endpoints de IA con cuota; datos de salud (perfil, plan vivo, registros) nunca visibles para otros miembros.

### 8. Arreglar
- **Arreglá vos** todo lo que encuentres, incluidas las tareas que DeepSeek dejó WIP o las "tareas difíciles" que no pudo: un commit por arreglo, `review(etapa-XX): <resumen>`, con su test.
- Solo si un arreglo es enorme (más de una tarea del plan entera) y no entra en esta llamada: escribilo como tarea `TX.Y-fix-N` en el informe (formato de tarea del plan: Objetivo, Archivos, Pasos, Aceptación), listalo en `progreso.md` → "Fixes pendientes" para DeepSeek, y marcá la etapa **bloqueada**.
- Después de arreglar, repetí los puntos 2 y 4.

### 9. Informe
Escribí `docs/reviews/etapa-XX.md` con la plantilla del §C.

### 10. Mergear y desplegar (solo si la etapa quedó en verde)
1. `git push`, y si no hay un PR abierto: `gh pr create --base main --head dev --title "Etapa XX: <nombre>" --body "<resumen + link al informe>"`.
2. `gh pr checks --watch` → CI en verde.
3. `gh pr merge --merge` (no borres `dev`).
4. Si hubo migraciones: verificá que el workflow de migraciones a producción haya corrido bien (`gh run list --workflow migrate.yml`).
5. Verificá el deploy: la URL de producción abre y `/api/health` responde `db: true`.
6. `git checkout dev && git merge main && git push` para que `dev` quede al día.

### 11. Cerrar
1. En `progreso.md`: la etapa pasa a **revisada** (fecha y link al informe), o **bloqueada** con el motivo.
2. Completá "Cierre de la Etapa XX" en su archivo del plan.
3. Commit y push.

---

## B. Revisión general (cuando las Etapas 1 a 10 están revisadas)

1. **Desde cero:** cloná el repo en `/tmp/recetario-check`, `pnpm install`, `pnpm db:start`, `pnpm db:reset`, `pnpm check`, `pnpm db:test`, `pnpm test:e2e`, `pnpm build`. Todo tiene que funcionar siguiendo solo `README.md` y `docs/deploy.md`; si falta un paso, corregí la documentación. Al terminar, `pnpm db:stop` en esa copia y borrala.
2. **Flujos de punta a punta** (viewport 390 × 844, dos usuarios):
   1. Alta con email y contraseña → crear grupo "Casa" → invitar → el segundo usuario se une.
   2. Cargar recetas: manual, pegando un link, con foto y dictando.
   3. Perfil alimentario por voz y plan vivo desde un PDF de ejemplo → indicadores de compatibilidad.
   4. Home sin plan → ¿Qué tenés? → elegir → home con plan.
   5. Armar la semana con la IA (una persona sin cebolla) → aprobar → lista de compras → tachar desde los dos usuarios.
   6. Meal prep del día → cocinar en modo stories con timers → preguntar al asistente en un paso → guardar un ajuste en la receta.
   7. Registrar comidas del plan vivo y usar un permitido.
   8. Compartir una receta por link y abrirla sin sesión.
   9. Offline: tachar la lista sin red y sincronizar.
   Cada flujo: OK / falla, con capturas.
3. **Diseño:** todas las pantallas de `docs/design/pantallas/` contra la app, en los tres temas.
4. **Seguridad:** todas las policies RLS y funciones `security definer`; endpoints públicos (`/r`, `/join`, `/api/cron/tick`, `/api/push`); cuotas de IA; datos de salud; cabeceras de seguridad; `pnpm audit`.
5. **IA:** corré todos los evals (`pnpm eval:*`) y reportá resultados, costo y latencia promedio desde `ai_runs`.
6. **Performance y accesibilidad:** Lighthouse mobile en Hoy, Recetas, Receta y Compras (objetivo ≥ 90); contraste en los tres temas; navegación por teclado.
7. **Producción:** deploy en verde, migraciones al día, variables completas, Sentry recibiendo errores (si está activo), backups de Supabase activos.
8. Arreglá lo que puedas (commits `review(final): …` en `dev`, después PR y merge como en A.10).
9. Informe `docs/reviews/final.md` (plantilla del §C + "Flujos de punta a punta" + "Lista de lanzamiento") y marcá la revisión general en `progreso.md`.

---

## C. Plantilla de informe

```markdown
# Revisión — Etapa XX: <nombre>

- Fecha: AAAA-MM-DD · Commits revisados: <primero>..<último>
- Veredicto: REVISADA Y MERGEADA | BLOQUEADA

## Pruebas automáticas
| Comando | Resultado |
|---|---|
| pnpm check | |
| pnpm db:test | |
| pnpm test:e2e | |
| pnpm build | |

## Criterios de aceptación
| Tarea | Criterio | Estado | Evidencia |
|---|---|---|---|

## Diseño
| Pantalla | Archivo de diseño | Diferencias | ¿Arreglado? |
|---|---|---|---|

## Código y seguridad
- <hallazgo> · gravedad alta/media/baja · archivo:línea · qué se hizo

## Arreglos hechos en la revisión
- `review(etapa-XX): …`

## Fixes pendientes para DeepSeek (solo si quedó bloqueada)
### TX.Y-fix-1 — Título
- Objetivo:
- Archivos:
- Pasos:
- Aceptación:
- [ ] Resuelto

## Para probar en el celular
1. …
```

---

## Respuesta final de cada llamada

En español, corta:
- Etapas revisadas y veredicto de cada una (mergeada / bloqueada y por qué).
- Resultado de las pruebas.
- Arreglos que hiciste.
- Fixes pendientes para DeepSeek, si hay.
- Qué tiene que probar la persona en el celular (3 a 6 pasos).
- Qué sigue: "volvé a pegar el prompt de DeepSeek" o "la app está lista".
