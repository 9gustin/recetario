# 02 · Código — instrucciones para DeepSeek

> Este archivo es tu guía completa. Leelo entero antes de escribir código. Cada vez que empieza una sesión, seguí la sección **"Cómo arranca cada sesión"**: así retomás exactamente donde quedó la anterior.

## Objetivo final

Implementar **todo el código de la app** siguiendo el plan, etapa por etapa (Etapas 1 a 10), hasta que todas las tareas estén tildadas en `docs/plan/README.md` y la app funcione como describe `docs/SPEC.md`, con el aspecto de `docs/design/`.

El proyecto ya está configurado (Etapa 0 hecha por otro agente): Next.js, Supabase local, sistema de diseño con tres temas, barra inferior, PWA, pruebas, CI, y todas las claves y servicios externos. **No configurás nada externo.**

Después de cada etapa, otro agente (Sonnet) revisa tu trabajo. Si deja arreglos, los hacés primero.

---

## Cómo arranca cada sesión

1. `cd ~/projects/recetario && git checkout dev && git pull`.
2. `pnpm install` y `pnpm db:start` (si ya está levantada, no pasa nada).
3. Leé:
   - `CLAUDE.md`
   - este archivo completo
   - `docs/execution/progreso.md`
   - `docs/design/README.md`
4. **¿Hay arreglos pendientes?** Si `docs/execution/progreso.md` lista fixes pendientes (o algún `docs/reviews/etapa-XX.md` tiene tareas `-fix-` sin tildar), hacelos primero con el mismo procedimiento de tarea (§3), commit `<ID-FIX>: <resumen>`, y tildalos en el informe y en `progreso.md`.
5. **Próxima tarea:** es la primera de la lista del §2 que **no** esté tildada `[x]` en el tablero de `docs/plan/README.md` y no esté marcada WIP en `progreso.md`.
6. Decí en una línea: "Sigo con <ID> — <título> (Etapa <N>)" y empezá.

---

## 1. Reglas (obligatorias)

1. **Una tarea por vez y nada más que esa tarea.** Solo sus archivos y pasos. Nada de lo que diga "Fuera de alcance". Si ves algo para mejorar en otro lado, anotalo en "Notas de ejecución"; no lo toques.
2. **No inventes.** No agregues dependencias que la tarea no nombre. No inventes tablas, columnas, rutas ni variables de entorno: si no están en el spec o en el plan, elegí lo más simple **dentro** de lo definido y anotalo.
3. **Base de datos.** Migración nueva por cambio (nunca editar una ya commiteada), con RLS habilitado y policies en el mismo archivo. Después: `pnpm db:reset && pnpm db:types`.
4. **Diseño.** Cada pantalla tiene que parecerse a su archivo de `docs/design/pantallas/` (indicado en §2): misma estructura, jerarquía, tamaños de letra, espaciados y botón principal. **Nunca escribas colores hex** en componentes: usá las clases de tokens (§5). Títulos con `font-display`. Íconos de `lucide-react`. Áreas táctiles de 44 px o más. Mobile-first a 390 px.
5. **Textos** visibles en español rioplatense con voseo ("Agregá", "Tocá para grabar"). Siempre con estado de carga, estado vacío y estado de error.
6. **Reutilizá** lo que ya existe en `components/` y `lib/` antes de crear algo nuevo. Mirá cómo se hicieron las tareas anteriores y copiá el estilo.
7. **Pruebas.** Nunca borres ni debilites un test para que pase.
8. **Seguridad.** Nunca escribas claves en archivos ni las imprimas. Usá el cliente admin (`lib/supabase/admin.ts`) solo si la tarea lo pide. Validá con Zod todo lo que entra en Server Actions y Route Handlers.
9. **Pasos 👤** dentro de las tareas (cuentas, claves, consolas web): **ya están hechos**. Saltealos.
10. **Commits:** uno por tarea, `git add -A && git commit -m "<ID>: <resumen en inglés>" && git push`. Siempre en la rama `dev`.

---

## 2. Orden de trabajo: todas las tareas

Las tareas están detalladas (pasos, archivos, aceptación) en `docs/plan/<archivo de la etapa>`. Acá está el orden, el diseño de referencia de cada una y avisos puntuales.

`P/` = `docs/design/pantallas/` · `§3` = `docs/design/README.md` §3 (pantallas sin diseño propio)

### Etapa 1 — Auth y grupos · `docs/plan/etapa-01-auth-grupos.md`
- T1.1 Migración: perfiles, grupos, miembros, invitaciones
- T1.2 Tests de RLS (pgTAP)
- T1.3 Login (Google + magic link) — diseño: `P/Perfil.html` (cabecera) + `§3` (login). Google ya está configurado.
- T1.4 Grupo activo y selector
- T1.5 Administrar grupos — diseño: `P/Perfil.html` (lista de grupos)
- T1.6 Invitaciones por link — diseño: `§3` (unirse por invitación)
- T1.7 E2E de grupos

### Etapa 2 — Recetario manual · `docs/plan/etapa-02-recetario.md`
- T2.1 Migración: recetas e ingredientes
- T2.2 Dominio: unidades, parser de ingredientes y escalado
- T2.3 Catálogo de ingredientes (seed) y matcher
- T2.4 Esquemas y acceso a datos de recetas
- T2.5 Formulario de receta — diseño: `§3` (formulario)
- T2.6 Detalle de receta — diseño: `P/Receta.html`
- T2.7 Lista, búsqueda y filtros — diseño: `P/Recetas.html`
- T2.8 Historial de versiones — diseño: `§3` (historial)
- T2.9 E2E del recetario

### Etapa 3 — Modo cocinar · `docs/plan/etapa-03-modo-cocinar.md`
- T3.1 Migración: sesiones de cocina
- T3.2 Motor de stories — diseño: `P/Cocinar.html`
- T3.3 Timers — diseño: `P/Cocinar.html` (temporizador y chip flotante)
- T3.4 Pantalla siempre encendida
- T3.5 Persistir y retomar la sesión
- T3.6 Ajustar la receta mientras cocino — diseño: `P/Cocinar.html` (botón de lápiz)
- T3.7 Pantalla final — diseño: `§3`
- T3.8 Tests del modo cocinar

### Etapa 4 — Compartir · `docs/plan/etapa-04-compartir.md`
- T4.1 Migración y RPCs de compartir
- T4.2 Sheet de compartir — diseño: `§3`
- T4.3 Página pública de receta — diseño: `P/Receta.html` (sin barra inferior)
- T4.4 Bandeja de entrada — diseño: `§3`
- T4.5 Origen de las copias
- T4.6 E2E de compartir

### Etapa 5 — IA: importar recetas y voz · `docs/plan/etapa-05-ia-importar.md`
- T5.1 Infraestructura de IA — `ANTHROPIC_API_KEY` ya está en `.env.local`.
- T5.2 Voz: grabar y transcribir — el proveedor ya está elegido (ver "Notas de ejecución" de la etapa). **No hagas el paso 6.**
- T5.3 Importar desde URL
- T5.4 Endpoint de parseo de recetas
- T5.5 UI de importación — diseño: `P/QueTenes.html` (inputs y micrófono)
- T5.6 Evals de parseo — llaman a la API real: corrélos **una sola vez** al final.

### Etapa 5b — Preguntale · `docs/plan/etapa-05b-asistente.md`
- T5B.1 Migración: conversaciones del asistente
- T5B.2 Motor del asistente
- T5B.3 UI del chat y menciones con @ — diseño: `P/Asistente.html`, `P/Noche.html` (botón Preguntar), `P/Receta.html` (botón de preguntar)
- T5B.4 Preguntar mientras cocinás — diseño: `P/CocinarPregunta.html`, `P/Cocinar.html`
- T5B.5 Evals del asistente — una sola corrida al final.
- (T5B.6 se hace después de la Etapa 8b.)

### Etapa 6 — Perfil alimentario · `docs/plan/etapa-06-perfil-alimentario.md`
- T6.1 Migración: perfiles alimentarios
- T6.2 Esquema del perfil
- T6.3 Endpoint de ingesta
- T6.4 UI "Mi alimentación" — diseño: `P/Perfil.html`
- T6.5 Dominio: compatibilidad receta ↔ perfil
- T6.6 Indicadores y filtro "apto para" — diseño: `P/Recetas.html`, `P/Receta.html`
- T6.7 Adaptar receta a un perfil

### Etapa 7 — Plan semanal + Hoy · `docs/plan/etapa-07-plan-semanal.md`
- T7.1 Migración: planes
- T7.2 Dominio: semanas y momentos
- T7.3 Pantalla del plan — diseño: `P/Plan.html`
- T7.4 Aprobar, historial y duplicar
- T7.5 Home "Hoy" con estados — diseño: `P/Mediodia.html`, `P/Tarde.html`, `P/Noche.html`
- T7.6 Tiempo real en el plan
- T7.7 Dominio: `validatePlan` — **tarea difícil** (ver §4)
- T7.8 Agente del plan — **tarea difícil** (ver §4)
- T7.9 UI del chat del plan — diseño: `P/Plan.html` (panel de chat)
- T7.10 Recetas nuevas de la IA
- T7.11 Evals del plan — una sola corrida al final.
- T7.12 ¿Qué tenés? — diseño: `P/QueTenes.html`
- T7.13 Ideas para hoy — diseño: `P/Opciones.html`
- T7.14 E2E de la home

### Etapa 8 — Lista de compras · `docs/plan/etapa-08-lista-compras.md`
- T8.1 Migración: listas
- T8.2 Dominio: armar la lista — **tarea difícil** (ver §4)
- T8.3 Generar y regenerar la lista
- T8.4 Enriquecer con IA
- T8.5 UI de la lista — diseño: `P/Compras.html`
- T8.6 E2E del ciclo completo

### Etapa 8b — Plan vivo · `docs/plan/etapa-08b-plan-vivo.md`
- T8B.1 Migración: plan vivo y registro
- T8B.2 Dominio: adherencia y permitidos
- T8B.3 Digitalizar el plan
- T8B.4 Ajustar el plan charlando — diseño: `P/PlanCargar.html`
- T8B.5 Pantalla "Mi plan" — diseño: `P/PlanVivo.html`, `P/Perfil.html` (tarjeta Mi plan)
- T8B.6 Registrar y seguimiento — diseño: `P/PlanSeguimiento.html`
- T8B.7 Integración con plan semanal e ideas
- T8B.8 Evals y E2E
- **T5B.6** Sumar contexto de etapas posteriores — está en `docs/plan/etapa-05b-asistente.md`; tildala ahí.

### Etapa 9 — Meal prep · `docs/plan/etapa-09-meal-prep.md`
- T9.1 Jobs en segundo plano (Inngest) — Inngest ya está configurado.
- T9.2 Generar tareas de meal prep
- T9.3 UI de preparaciones — diseño: `P/Mediodia.html` (agenda del día)
- T9.4 Variedad y conservación

### Etapa 10 — Notificaciones y pulido · `docs/plan/etapa-10-notificaciones-pulido.md`
- T10.1 Web Push — las claves VAPID ya están.
- T10.2 Bandeja completa
- T10.3 Offline
- T10.4 Onboarding — diseño: `§3` + hero de `P/Tarde.html`
- T10.5 Accesibilidad y performance
- T10.6 Privacidad: exportar y borrar cuenta

---

## 3. Procedimiento de cada tarea

**A. Leer (no escribas código todavía)**
1. La tarea completa en el archivo de su etapa, y las tareas que figuran en su "Depende de".
2. Las secciones de `docs/SPEC.md` que cita en "Spec".
3. El diseño de referencia del §2 (si no tiene, `docs/design/README.md` §3).
4. Los archivos que ya existen y vas a usar o modificar. `git log --oneline -15` para ver lo último que se hizo.

**B. Planear** — Escribí en 3 a 6 líneas: archivos a crear/modificar y cómo cumplís cada criterio de "Aceptación".

**C. Implementar** — Seguí los "Pasos" de la tarea en orden, respetando las reglas del §1 y los patrones del §5.

**D. Verificar**
1. La "Verificación" de la tarea.
2. `pnpm check` siempre; `pnpm db:test` si tocaste la base; el e2e de la tarea si tiene uno.
3. Si una pantalla es nueva: levantá `pnpm dev` y compará con el diseño (estructura, tamaños, espaciados, botón principal, barra inferior).
4. Revisá cada criterio de "Aceptación" y decí si se cumple.

**E. Cerrar**
1. Tildá `[x]` la tarea en su archivo de etapa y en el tablero de `docs/plan/README.md`.
2. Decisiones fuera del plan → "Notas de ejecución" del archivo de la etapa.
3. Actualizá "Próxima tarea" en `docs/execution/progreso.md`.
4. Commit y push (regla 10).
5. Una línea de avance: `✅ <ID> lista — <qué hace>`.

**F. ¿Era la última tarea de la etapa?**
1. Corré todo: `pnpm check`, `pnpm db:test`, `pnpm test:e2e`, `pnpm build`.
2. En `progreso.md`, sección "Código": marcá la etapa como **"lista para revisión"**.
3. **Frená** y respondé con el resumen de la etapa (§6). La persona va a correr la revisión y después te vuelve a llamar.

Si no era la última, seguí con la siguiente tarea.

---

## 4. Cuándo frenar o saltear

- **Falla repetida:** si una tarea falla 3 veces por la misma causa (2 veces si es **tarea difícil**): dejá el código como está, anotá el problema en "Notas de ejecución", **no** la tildes, agregala como WIP en `progreso.md`, commit `<ID>: WIP - <problema>`, y seguí con la siguiente tarea que no dependa de ella. La revisión la resuelve.
- **Falta información:** elegí la opción más simple dentro de lo que define el plan y anotalo.
- **Contexto lleno o sesión cortada:** pedile a la persona que abra una sesión nueva con el mismo prompt. Gracias a `progreso.md` y al tablero, retomás donde estabas.
- **Algo roto de una etapa anterior:** no lo arregles por tu cuenta; anotalo en `progreso.md` → "Problemas encontrados" y seguí.

---

## 5. Patrones del proyecto (copiar, no reinventar)

Si el código existente difiere de estos ejemplos, **gana el código existente**.

### Clases de tokens (nunca hex)

| Uso | Clase |
|---|---|
| Fondo de pantalla | `bg-background` |
| Tarjetas | `bg-surface` (secundarias: `bg-surface-2`) |
| Texto principal / secundario | `text-foreground` / `text-muted` |
| Botón principal | `bg-accent text-accent-foreground rounded-full min-h-[54px]` (o el componente `PillButton`) |
| Bloque grande de arriba | `bg-hero` (o el componente `Hero`) |
| Bordes | `border-border` |
| Apto / cumplido | `text-success` · Prohibido | `text-danger-soft` |
| Títulos serif | `font-display` |

### Server Action

```ts
// lib/<feature>/actions.ts
"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const Input = z.object({ groupId: z.string().uuid(), name: z.string().min(1).max(60) });

export async function renameGroup(raw: unknown): Promise<Result<{ id: string }>> {
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Revisá los datos" };
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groups").update({ name: parsed.data.name })
    .eq("id", parsed.data.groupId).select("id").single();
  if (error) return { ok: false, error: "No se pudo guardar" };
  return { ok: true, data };
}
```

### Migración con RLS

```sql
-- supabase/migrations/20261201120000_example.sql
create table public.example (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger example_updated_at before update on public.example
  for each row execute function public.set_updated_at();

alter table public.example enable row level security;
create policy "members read"   on public.example for select using (public.is_group_member(group_id));
create policy "members insert" on public.example for insert with check (public.is_group_member(group_id));
create policy "members update" on public.example for update using (public.is_group_member(group_id));
create policy "members delete" on public.example for delete using (public.is_group_member(group_id));
```

### Página (Server Component)

```tsx
// app/(app)/g/[groupId]/ejemplo/page.tsx
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function Page({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  await requireUser();
  const supabase = await createClient();
  const { data: items } = await supabase.from("example").select("id, name").eq("group_id", groupId);

  return (
    <main className="flex flex-col gap-3 px-5 pt-5">
      <h1 className="font-display text-[34px] leading-none">Título</h1>
      {items?.length ? (
        items.map((it) => (
          <div key={it.id} className="rounded-2xl bg-surface px-4 py-3 text-[15px]">{it.name}</div>
        ))
      ) : (
        <p className="text-muted">Todavía no hay nada acá.</p>
      )}
    </main>
  );
}
```

### Test de dominio

```ts
// lib/domain/scale.test.ts
import { describe, it, expect } from "vitest";
import { scaleQuantity } from "./scale";

describe("scaleQuantity", () => {
  it.each([
    [200, 2, 4, 400],
    [1, 2, 3, 1.5],
  ])("%d de %d a %d porciones → %d", (qty, from, to, expected) => {
    expect(scaleQuantity(qty, from, to)).toBe(expected);
  });
});
```

---

## 6. Respuesta al frenar (fin de etapa o fin de sesión)

En español, corto:
1. Tareas terminadas en esta sesión.
2. Tareas WIP y por qué.
3. Resultado de `pnpm check`, `pnpm db:test`, `pnpm test:e2e`, `pnpm build`.
4. Decisiones tomadas fuera del plan.
5. Si terminaste una etapa: "Etapa <N> lista para revisión. Corré el paso 3 (revisión con Sonnet) y después volvé a pegarme el prompt."
