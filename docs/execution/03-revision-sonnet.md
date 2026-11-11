# 03 · Revisión y pruebas — Claude Sonnet

Sonnet revisa **cada etapa** antes de que entre a `main`, y al final hace una **revisión general** de la app completa. Se usa en **Claude Code** con **Sonnet**, abierto en `~/projects/recetario` (WSL). Para los hallazgos de seguridad marcados 🧠, conviene repetir esa parte con Opus.

- Línea de tiempo: [README.md](README.md)
- Arreglos grandes vuelven a DeepSeek: [02-codigo-deepseek.md](02-codigo-deepseek.md) §4

---

## A. Revisión de etapa

Cuando DeepSeek terminó todas las tareas de la etapa y hiciste `git push`, abrí Claude Code nuevo con Sonnet y pegá:

```text
Sos el revisor técnico del proyecto en ~/projects/recetario (WSL). Revisás la Etapa <N> (rama etapa-<N>) antes de que entre a main.

LEER
1. CLAUDE.md, docs/execution/README.md y este archivo (docs/execution/03-revision-sonnet.md).
2. El archivo de la etapa en docs/plan/ (todas sus tareas, criterios de aceptación y "Notas de ejecución").
3. Las secciones de docs/SPEC.md que citan esas tareas.
4. docs/design/README.md y las pantallas de docs/design/pantallas/ asignadas a las tareas de la etapa (tabla del §5 de docs/execution/02-codigo-deepseek.md).
5. `git log main..etapa-<N> --oneline` y `git diff main...etapa-<N> --stat`.

HACER, EN ESTE ORDEN
1. Preparar: `git checkout etapa-<N> && git pull`, `pnpm install`, `pnpm db:start`, `pnpm db:reset`, `pnpm db:types` (no tiene que haber cambios en los tipos sin commitear).
2. Pruebas automáticas: `pnpm check`, `pnpm db:test`, `pnpm test:e2e`, `pnpm build`. Anotá cada resultado.
3. Criterios de aceptación: para cada tarea de la etapa, verificá cada criterio (leyendo el código y probándolo). Marcá cumplido / no cumplido con la evidencia.
4. Prueba manual de la app: levantá `pnpm dev`, abrila en el navegador con viewport de celular (390×844) y recorré el flujo principal de la etapa como usuario, en los tres temas (forzando mediodía / tarde / noche). Sacá capturas de las pantallas principales.
5. Diseño: compará cada pantalla implementada con su archivo de diseño (estructura, jerarquía, tamaños de tipografía, espaciados, botón principal, barra inferior). Verificá que no haya colores hex en componentes (`grep -rn "#[0-9A-Fa-f]\{6\}" app components`) y que los textos estén en español con voseo.
6. Código: revisá el diff completo buscando: lógica de negocio fuera de lib/domain, `any`, errores sin manejar, consultas N+1, componentes duplicados, dependencias no previstas en el plan, tareas que se salieron de su alcance.
7. Seguridad: toda tabla nueva con RLS y policies; uso del cliente admin solo donde el plan lo indica; funciones security definer con `set search_path` y chequeo de permisos; validación Zod en cada Server Action y Route Handler; nada de claves en el repo; endpoints de IA con cuota. Si la etapa toca RLS, tokens públicos o datos de salud, marcá la revisión de seguridad como 🧠.
8. Arreglos:
   - Problemas chicos y claros (menos de ~30 líneas, sin decisiones de diseño): arreglalos vos, con su test, un commit por arreglo: "review(etapa-<N>): <resumen>".
   - Problemas grandes o que tocan varias partes: NO los arregles. Escribilos como tareas "T<N>.<tarea>-fix-<n>" en el informe, con el mismo formato que las tareas del plan (Objetivo, Archivos, Pasos, Aceptación), para que los haga DeepSeek.
9. Informe: escribí docs/reviews/etapa-<N>.md con la plantilla de la sección C de este archivo, commitealo en la rama.
10. Decisión:
   - Si hay tareas fix pendientes o alguna prueba falla: NO mergees. Decime qué fixes tiene que hacer DeepSeek y terminá.
   - Si todo está en verde: pusheá, abrí un PR etapa-<N> → main con `gh pr create` (resumen + link al informe), esperá el CI en verde (`gh pr checks --watch`), mergealo con `gh pr merge --squash --delete-branch`, y si hay migraciones nuevas verificá que el workflow de migraciones a producción haya corrido bien. Verificá el deploy de producción (/api/health).
11. Marcá "Cierre de la Etapa <N>" en el archivo de la etapa con lo que quedó verificado.

RESPUESTA FINAL (en español, corta):
- Veredicto: MERGEADA / BLOQUEADA (por qué).
- Pruebas: resultado de cada comando.
- Arreglos que hiciste.
- Tareas fix para DeepSeek (IDs).
- Qué tengo que probar yo en el celular (lista de 3 a 6 pasos).
```

### Después de los fixes

Cuando DeepSeek resolvió las tareas fix:

```text
Sos el revisor técnico del proyecto en ~/projects/recetario. En la rama etapa-<N> se resolvieron las tareas fix de docs/reviews/etapa-<N>.md.
Leé el informe, verificá cada fix (código + test) y repetí los pasos 2, 4 y 7 de la revisión de etapa (docs/execution/03-revision-sonnet.md, sección A).
Actualizá el informe y, si todo está en verde, seguí con el paso 10 (PR, CI, merge y deploy).
```

---

## B. Revisión general (al terminar la Etapa 10)

```text
Sos el revisor final del proyecto en ~/projects/recetario (WSL). Todas las etapas están mergeadas en main. Hacé una revisión general de la app completa antes de usarla en serio.

LEER: CLAUDE.md, docs/SPEC.md completo, docs/design/README.md, todos los informes de docs/reviews/ y el tablero de docs/plan/README.md.

HACER
1. Desde cero: clonar el repo en una carpeta temporal, `pnpm install`, `pnpm db:start`, `pnpm db:reset`, `pnpm check`, `pnpm db:test`, `pnpm test:e2e`, `pnpm build`. Todo tiene que funcionar siguiendo solo el README y docs/deploy.md; si falta un paso, corregí la documentación.
2. Flujos de punta a punta (navegador con viewport 390×844, dos usuarios en dos contextos):
   a) Alta con Google o magic link → crear grupo "Casa" → invitar → el segundo usuario se une.
   b) Cargar recetas: manual, pegando un link, con foto y dictando.
   c) Perfil alimentario por voz y plan vivo desde un PDF de ejemplo → indicadores de compatibilidad.
   d) Home sin plan → ¿Qué tenés? → elegir → home con plan.
   e) Armar la semana con la IA (con una persona sin cebolla) → aprobar → lista de compras → tachar desde los dos usuarios.
   f) Meal prep del día → cocinar en modo stories con timers → preguntar al asistente en un paso → guardar un ajuste en la receta.
   g) Registrar comidas del plan vivo y usar un permitido.
   h) Compartir una receta por link y abrirla sin sesión.
   i) Offline: tachar la lista sin red y sincronizar.
   Anotá cada flujo como OK / falla, con capturas.
3. Diseño: recorré todas las pantallas de docs/design/pantallas/ contra la app, en los tres temas. Lista de diferencias.
4. Seguridad 🧠: auditoría de todas las policies RLS y funciones security definer, endpoints públicos (/r, /join, /api/inngest, /api/push), cuotas de IA, datos de salud (perfil, plan vivo, registros) nunca visibles para otros, cabeceras de seguridad, dependencias con vulnerabilidades (`pnpm audit`).
5. Calidad de IA: correr todos los evals (`pnpm eval:*`) y reportar resultados, costo y latencia promedio desde ai_runs.
6. Performance y accesibilidad: Lighthouse mobile en Hoy, Recetas, Receta y Compras (objetivo ≥ 90), contraste en los tres temas, navegación por teclado.
7. Producción: deploy en verde, migraciones al día, variables de entorno completas, Sentry recibiendo errores, backups de Supabase activos.
8. Informe: docs/reviews/final.md con la plantilla de la sección C (agregando "Flujos de punta a punta" y "Lista de lanzamiento"). Arreglos chicos los hacés vos; los grandes quedan como tareas "FINAL-fix-<n>".

RESPUESTA FINAL: veredicto (lista para usar / falta), los 5 problemas más importantes y qué tengo que probar yo en mi celular y en el de mi pareja.
```

---

## C. Plantilla de informe (`docs/reviews/etapa-XX.md`)

```markdown
# Revisión — Etapa XX: <nombre>

- Fecha: AAAA-MM-DD · Rama: etapa-XX · Commits revisados: <primero>..<último>
- Veredicto: MERGEADA | BLOQUEADA

## Pruebas automáticas
| Comando | Resultado |
|---|---|
| pnpm check | ✅ / ❌ (detalle) |
| pnpm db:test | |
| pnpm test:e2e | |
| pnpm build | |

## Criterios de aceptación
| Tarea | Criterio | Estado | Evidencia |
|---|---|---|---|

## Diseño
| Pantalla | Archivo de diseño | Diferencias |
|---|---|---|

## Código y seguridad
- Hallazgo · gravedad (alta / media / baja) · archivo:línea · qué se hizo

## Arreglos hechos en la revisión
- `review(etapa-XX): …`

## Tareas fix para DeepSeek
### TX.Y-fix-1 — Título
- Objetivo:
- Archivos:
- Pasos:
- Aceptación:
- [ ] Resuelto

## Para probar en el celular
1. …
```
