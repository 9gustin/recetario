# Ejecución

Tres archivos de instrucciones, uno por rol. Cada agente lee su archivo y hace todo lo que dice, de principio a fin. El avance se comparte en [`progreso.md`](progreso.md), así que cualquier sesión puede cortarse y retomarse pegando el mismo prompt.

| Paso | Modelo | Instrucciones | Qué deja hecho |
|---|---|---|---|
| 1 | Claude Sonnet (Claude Code) | [01-configuracion-sonnet.md](01-configuracion-sonnet.md) | Etapa 0 completa y todos los servicios configurados (Supabase, Vercel, CI, Google, Anthropic, voz, Inngest, Web Push). Rama `dev` lista. |
| 2 | DeepSeek (local) | [02-codigo-deepseek.md](02-codigo-deepseek.md) | El código de las Etapas 1 a 10, tarea por tarea. Frena al terminar cada etapa. |
| 3 | Claude Sonnet (Claude Code) | [03-revision-sonnet.md](03-revision-sonnet.md) | Revisa y prueba cada etapa terminada, arregla, mergea a `main` y despliega. Al final, revisión general. |

## Cómo se usa

```
1 (una vez) → 2 → 3 → 2 → 3 → … → 2 → 3 (revisión general al final)
```

1. Pegá el **prompt 1** en Claude Code con Sonnet. Te va a pedir que crees cuentas y pegues claves en lugares concretos.
2. Pegá el **prompt 2** en DeepSeek. Trabaja hasta terminar una etapa y frena.
3. Pegá el **prompt 3** en Claude Code con Sonnet. Revisa esa etapa, la mergea y te dice qué probar en el celular.
4. Volvé al 2. Repetí hasta la Etapa 10; la última vez, el 3 hace la revisión general.

Si cualquier sesión se corta, abrí una nueva y pegá el mismo prompt: retoma desde `progreso.md`.

## Los 3 prompts

**1 · Sonnet — configuración** (Claude Code, modelo Sonnet, en `~/projects/recetario`):

```text
Leé docs/execution/01-configuracion-sonnet.md y ejecutalo completo, de principio a fin. Antes de empezar, leé docs/execution/progreso.md y retomá desde el primer paso de configuración sin tildar.
```

**2 · DeepSeek — código** (tu agente con DeepSeek, en `~/projects/recetario`):

```text
Leé docs/execution/02-codigo-deepseek.md completo y seguilo al pie de la letra, empezando por la sección "Cómo arranca cada sesión". Usá docs/execution/progreso.md para saber dónde retomar. Trabajá tarea por tarea hasta terminar la etapa en curso y frená como indica el archivo.
```

**3 · Sonnet — revisión** (Claude Code, modelo Sonnet, en `~/projects/recetario`):

```text
Leé docs/execution/03-revision-sonnet.md y ejecutalo completo, empezando por "Cómo arranca cada llamada". Usá docs/execution/progreso.md para saber qué etapas revisar.
```
