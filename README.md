# Recetario 🍲

> Nombre provisorio.

Las recetas de tu casa, compartidas con tu familia. Planificá la semana respetando cómo come cada uno, comprá una sola vez y cociná paso a paso desde el celular.

## Qué hace

- **Grupos:** creá "Casa", invitá a tu pareja o a tu familia con un link. Grupos y miembros ilimitados.
- **Recetario compartido:** recetas con ingredientes, pasos y tiempos. Cargalas escribiendo, pegando un link, con una foto o dictándolas.
- **Compartir:** mandá una receta por link (se ve sin cuenta), copiala a otro grupo o enviásela a alguien.
- **Perfil alimentario:** contá por voz o subí el plan del nutricionista. La IA arma tu perfil (qué no podés comer, qué te gusta, qué objetivos tenés) y marca qué recetas son aptas para cada uno.
- **Plan semanal con IA:** "armame la semana" y lo van charlando. Respeta las restricciones, varía las comidas y pone primero lo que se pone feo antes.
- **Lista de compras:** se arma sola desde el plan, por sección del súper, y la tachan entre los dos en tiempo real.
- **Meal prep:** sugerencias de qué cortar, porcionar, freezar o descongelar y cuándo.
- **Modo cocinar:** pantalla completa tipo historias de Instagram, un paso por pantalla, con timers. Lo que ajustás mientras cocinás queda guardado en la receta.

## Estado

📝 **Planificación.** Todavía no hay código. El desarrollo se ejecuta tarea por tarea siguiendo el plan.

## Documentación

| Documento | Contenido |
|---|---|
| [`docs/SPEC.md`](docs/SPEC.md) | Spec de producto y técnico: features, arquitectura, modelo de datos, diseño de la IA, API y pantallas. |
| [`docs/plan/README.md`](docs/plan/README.md) | Plan de desarrollo: cómo ejecutar cada tarea con Claude Code, prerrequisitos y tablero de avance. |
| [`docs/plan/etapa-*.md`](docs/plan/) | Las 11 etapas con sus tareas, criterios de aceptación y verificación. |
| [`CLAUDE.md`](CLAUDE.md) | Reglas y convenciones del repo para el agente. |

## Stack

Next.js (PWA) · TypeScript · Tailwind + shadcn/ui · Supabase (Postgres, Auth, Storage, Realtime) · Claude API · Inngest · Vercel.

## Hitos

1. **MVP-1** (etapas 0–4): recetario compartido, modo cocinar y compartir.
2. **MVP-2** (etapas 5–8): IA para importar recetas, perfil alimentario, plan semanal y lista de compras.
3. **Etapas 9–10:** meal prep, notificaciones, offline y pulido.

## Desarrollo

Cuando exista el código (desde la Etapa 0):

```bash
pnpm install
pnpm db:start      # Supabase local (requiere Docker)
pnpm dev           # http://localhost:3000
pnpm check         # lint + typecheck + tests
```
