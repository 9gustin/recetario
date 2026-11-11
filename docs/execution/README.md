# Ejecución — quién hace qué y en qué orden

El desarrollo se reparte en tres roles. Cada uno tiene su archivo con el prompt listo para pegar.

| Rol | Modelo | Qué hace | Archivo |
|---|---|---|---|
| **Configuración** | Claude Sonnet (Claude Code) | Fundaciones del proyecto (Etapa 0 completa), cuentas y servicios externos, variables de entorno, CI, deploy, y la configuración puntual que pide cada etapa. | [01-configuracion-sonnet.md](01-configuracion-sonnet.md) |
| **Código** | DeepSeek (local) | Implementa las tareas de código de las Etapas 1 a 10, una tarea por vez, en una rama por etapa. | [02-codigo-deepseek.md](02-codigo-deepseek.md) |
| **Revisión** | Claude Sonnet (Claude Code) | Al cerrar cada etapa: levanta el proyecto, corre todas las pruebas, compara con el diseño, revisa seguridad, arregla lo chico, deja tareas para lo grande, mergea y despliega. Al final, una revisión general. | [03-revision-sonnet.md](03-revision-sonnet.md) |

Por qué así:
- **La Etapa 0 entera la hace Sonnet**: además de configuración (base de datos, Vercel, CI) incluye el sistema de diseño y la estructura de la app. Si esa base queda bien, todo lo que construya después un modelo más básico sale consistente.
- **DeepSeek solo escribe código** con tareas muy cerradas: archivos concretos, pasos, criterios de aceptación y la pantalla del diseño que corresponde ([`docs/design/`](../design/README.md)).
- **Sonnet revisa cada etapa antes de mergear**: así los errores no se acumulan de una etapa a la siguiente.

---

## Línea de tiempo

```
FASE 0 ─ Configuración inicial (Sonnet) ─────────────────────────────────────────
  Prerrequisitos 👤 → Etapa 0 completa (T0.1–T0.8) → app vacía en producción

POR CADA ETAPA (1 → 10) ─────────────────────────────────────────────────────────
  ① Configuración puntual (Sonnet)   solo si la etapa la necesita (tabla abajo)
  ② Código (DeepSeek)                 rama etapa-XX, una tarea por sesión, commit por tarea
  ③ Revisión de etapa (Sonnet)        pruebas + diseño + seguridad → arreglos → merge a main → deploy
        └─ si hay problemas grandes: tareas "TX.Y-fix" → vuelven a ② → ③ de nuevo

FASE FINAL ─ Revisión general (Sonnet) ──────────────────────────────────────────
  App completa: pruebas, flujos de punta a punta en el celular, seguridad, performance
```

## Orden de etapas y quién hace cada cosa

| # | Etapa | ① Config. puntual (Sonnet) | ② Código (DeepSeek) | ③ Revisión (Sonnet) |
|---|---|---|---|---|
| 0 | Fundaciones | **Toda la etapa** (T0.1–T0.8) | — | Revisión de Etapa 0 |
| 1 | Auth y grupos | Google OAuth en Google Cloud + Supabase (local y prod), URLs de redirect | T1.1–T1.7 (la parte 👤 de T1.3 ya está hecha) | ✔ |
| 2 | Recetario | — | T2.1–T2.9 | ✔ |
| 3 | Modo cocinar | — | T3.1–T3.8 | ✔ |
| 4 | Compartir | — | T4.1–T4.6 | ✔ **MVP-1** |
| 5 | IA: importar | API key de Anthropic; proveedor de transcripción + prueba de calidad (paso 6 de T5.2) | T5.1–T5.6 | ✔ |
| 5b | Preguntale | — | T5B.1–T5B.5 | ✔ |
| 6 | Perfil alimentario | — | T6.1–T6.7 | ✔ |
| 7 | Plan semanal + Hoy | — | T7.1–T7.14 | ✔ |
| 8 | Lista de compras | — | T8.1–T8.6 | ✔ **MVP-2** |
| 8b | Plan vivo | — | T8B.1–T8B.8, y después **T5B.6** | ✔ |
| 9 | Meal prep | Cuenta de Inngest + integración con Vercel | T9.1–T9.4 | ✔ |
| 10 | Notificaciones y pulido | Claves VAPID en Vercel | T10.1–T10.6 | ✔ + **Revisión general** |

## Ramas y commits

- `main` siempre deployable. Solo la **revisión** mergea a `main`.
- DeepSeek trabaja en `etapa-XX` (ej. `etapa-02`), un commit por tarea: `T2.3: <resumen>`.
- La revisión abre un PR `etapa-XX → main`, deja el informe en `docs/reviews/etapa-XX.md`, mergea y verifica el deploy.

## Qué hacés vos (👤)

- Crear cuentas y pegar claves cuando la configuración te lo pida (nunca le pases claves a DeepSeek ni las escribas en archivos commiteados).
- Abrir cada sesión con el prompt del rol y la etapa/tarea que toca.
- Probar en tu celular al cierre de cada etapa (la revisión te dice qué probar).
- Marcar avance: el tablero está en [`docs/plan/README.md`](../plan/README.md) §5 (lo actualizan los agentes).
