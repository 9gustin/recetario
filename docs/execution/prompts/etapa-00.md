# Etapa 00 — Fundaciones

Plan: [`docs/plan/etapa-00-fundaciones.md`](../../plan/etapa-00-fundaciones.md). Tres prompts, en orden, cada uno en una sesión nueva.

| # | Quién | Qué |
|---|---|---|
| 1 | Sonnet | Configuración: T0.1, T0.5–T0.8 (proyecto, base de datos, pruebas, CI, producción) |
| 2 | Sonnet (recomendado) o DeepSeek | Código: T0.2–T0.4 (diseño, estructura, PWA) |
| 3 | Sonnet | Revisión de la etapa |

## 1 · Sonnet — configuración

```text
Sos el responsable de la configuración inicial del proyecto en ~/projects/recetario (WSL). El repo ya existe en GitHub (9gustin/recetario, privado) y `gh` está logueado.

Leé: CLAUDE.md, docs/execution/README.md, docs/execution/01-configuracion-sonnet.md (secciones A y B), docs/plan/README.md, docs/plan/etapa-00-fundaciones.md y docs/SPEC.md §4.

Ejecutá en la rama main, en este orden, las tareas de configuración de la Etapa 0: T0.1, T0.5, T0.6, T0.7 y T0.8. Un commit por tarea ("T0.x: <resumen>"); marcá cada una en el plan y en el tablero.

Reglas:
- Antes de cada tarea, decime en 3 líneas qué vas a hacer; después, corré su verificación.
- T0.1: creá también AGENTS.md en la raíz con una línea: "Leé y seguí CLAUDE.md antes de hacer cualquier cosa."
- T0.5: verificá `docker info` dentro de WSL; si no responde, pedime que active la integración WSL en Docker Desktop. Copiá las claves locales de `supabase status` a .env.local (no se commitea).
- T0.6: si `playwright install --with-deps` pide sudo, pedime que lo corra yo.
- T0.7/T0.8: los pasos 👤 los hago yo (Supabase prod en São Paulo, Vercel, secrets de GitHub): guiame paso a paso y esperá mi confirmación. Nunca me pidas claves en el chat; decime en qué panel o archivo van.
- Escribí docs/deploy.md como dice T0.8.
- No hagas T0.2, T0.3 ni T0.4 (van en el prompt de código).

Al final verificá: `pnpm check`, `pnpm test:e2e`, `pnpm db:test`, CI en verde, URL de producción abriendo y /api/health con db: true. Decime qué quedó listo y cómo levanto todo desde cero.
```

## 2 · Código

```text
Vas a implementar la base visual y la estructura de la app (Etapa 0). Trabajás en ~/projects/recetario, en la rama main.

TAREAS, EN ESTE ORDEN (archivo: docs/plan/etapa-00-fundaciones.md):
1. T0.2 — Design system base  [diseño: SPEC §8.1 + tabla de tokens de docs/design/README.md · ojo: agregá --success y --danger-soft]
2. T0.3 — App shell mobile  [diseño: la barra inferior de docs/design/pantallas/Noche.html]
3. T0.4 — PWA instalable

Leé primero: CLAUDE.md, docs/SPEC.md §8, docs/design/README.md y docs/design/pantallas/Noche.html, Mediodia.html y Tarde.html.

Para cada tarea: leé la tarea completa → plan de 3 a 6 líneas → implementá siguiendo sus "Pasos" → corré su verificación y `pnpm check` → marcá [x] en el plan y en el tablero → commit "T0.x: <resumen>" → `git push`.

Reglas: solo esas tareas; sin dependencias que la tarea no nombre; los tokens de los tres temas tienen que coincidir exactamente con SPEC §8.1; nada de hex en componentes fuera de globals.css; textos en español con voseo.

Al final decime qué hiciste, cómo lo veo (`pnpm dev` y `/dev/ui`) y las decisiones que tomaste.
(Recomendado correr este prompt con Sonnet: es la base visual de toda la app. Si preferís DeepSeek, funciona igual.)
```

## 3 · Sonnet — revisión

```text
Sos el revisor técnico del proyecto en ~/projects/recetario (WSL). Revisás la Etapa 00 (ya está en main: no hay PR ni merge; en el paso 10 solo verificá CI y deploy).

Seguí la sección A de docs/execution/03-revision-sonnet.md (pasos 1 a 11) con estos valores:
- Archivo de la etapa: docs/plan/etapa-00-fundaciones.md
- Informe: docs/reviews/etapa-00.md
- Pantallas de diseño a comparar: docs/design/pantallas/Mediodia.html, docs/design/pantallas/Noche.html, docs/design/pantallas/Tarde.html

Empezá leyendo CLAUDE.md, docs/execution/03-revision-sonnet.md, docs/plan/etapa-00-fundaciones.md y `git log --oneline`.

Importante:
- Tareas marcadas WIP o sin [x]: si son chicas, terminalas vos; si son grandes (o son tareas difíciles de lógica/IA que DeepSeek no pudo), resolvelas vos también si te alcanza esta sesión; si no, dejalas como fix en el informe.
- Si dejás fixes para DeepSeek, no mergees: el mismo prompt de código de esta etapa los resuelve primero. Después volvés a correr ESTE prompt y revisás solo lo nuevo.
- Si es una segunda pasada (ya existe el informe), verificá los fixes, repetí los pasos 2, 4 y 7, actualizá el informe y seguí al paso 10.

RESPUESTA FINAL (en español, corta):
- Veredicto: MERGEADA / BLOQUEADA (por qué).
- Pruebas: resultado de cada comando.
- Arreglos que hiciste.
- Fixes para DeepSeek (IDs), si hay.
- Qué tengo que probar yo en el celular (3 a 6 pasos).
```
