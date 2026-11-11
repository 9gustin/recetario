# 02 · Código — DeepSeek (local)

DeepSeek implementa las tareas de código de las **Etapas 1 a 10**, con **un prompt por etapa** que recorre todas sus tareas en orden, en la rama de la etapa. Lo corrés vos en tu máquina con cualquier agente que pueda **leer y escribir archivos y correr comandos en la terminal** (por ejemplo Aider, OpenCode, Cline o Claude Code configurado con DeepSeek), abierto en `~/projects/recetario`.

Antes de cada etapa, Sonnet ya hizo la configuración puntual y creó la rama `etapa-XX` ([01-configuracion-sonnet.md](01-configuracion-sonnet.md) §C). Después de la última tarea de la etapa, Sonnet hace la revisión ([03-revision-sonnet.md](03-revision-sonnet.md)).

---

## 1. Cómo usar este archivo 👤

1. Abrí una sesión nueva del agente y pegá el **prompt 2 · DeepSeek — código** de la etapa, en [`prompts/etapa-XX.md`](prompts/README.md). Ya trae la lista de tareas con su diseño de referencia.
2. El agente hace las tareas una por una (commit por tarea) y te avisa al terminar cada una.
3. Si la sesión se corta o se llena el contexto, abrí una nueva y pegá **el mismo prompt**: retoma desde la primera tarea sin `[x]`.
4. Al terminar, pasá al prompt 3 (revisión con Sonnet). Si la revisión deja fixes, volvé a pegar el prompt 2: los resuelve primero.

Las secciones §3 y §4 de abajo (prompt por tarea suelta) quedan como alternativa si querés ir de a una tarea; la §5 es la referencia de diseño por tarea.

---

## 2. Reglas para el modelo

Estas reglas van dentro del prompt (§3). Están acá para que las conozcas.

1. **Una tarea y nada más.** Solo los archivos y pasos de la tarea. Si ves algo para mejorar en otra parte, anotalo en "Notas de ejecución"; no lo cambies.
2. **Leé antes de escribir:** `CLAUDE.md`, el archivo de la etapa (solo tu tarea y las que dice "Depende de"), las secciones del spec que cita la tarea y los archivos de diseño indicados. Mirá cómo están hechas las tareas anteriores (`git log`, archivos existentes) y copiá sus patrones.
3. **No inventes:**
   - No agregues dependencias que la tarea no nombre.
   - No inventes columnas, tablas, rutas ni variables de entorno: si no están en el spec o en el plan, frená y preguntá.
   - No cambies nombres de archivos que la tarea indica.
4. **Base de datos:** nunca edites una migración ya commiteada; creá una nueva. Toda tabla nueva lleva RLS y policies en la misma migración. Después: `pnpm db:reset && pnpm db:types`.
5. **Diseño:** la pantalla tiene que parecerse al archivo de `docs/design/pantallas/` indicado. Nunca copies colores hex: usá los tokens (`bg-background`, `bg-surface`, `text-muted`, `bg-accent`, `font-display`…), según la tabla de `docs/design/README.md`. Textos visibles en español con voseo.
6. **Pruebas:** nunca borres ni debilites un test para que pase. Si un test falla 3 veces seguidas por la misma causa, frená y explicá el problema.
7. **Seguridad:** nunca escribas claves en archivos. Nunca uses el cliente admin (`lib/supabase/admin.ts`) salvo que la tarea lo pida.
8. **Terminar bien:** `pnpm check` en verde (y `pnpm db:test` si tocaste la base) → marcar `[x]` en el archivo de la etapa y en el tablero de `docs/plan/README.md` → un commit `T<x>.<y>: <resumen>`.

---

## 3. Prompt de tarea

Copiá todo el bloque y reemplazá lo que está entre `< >`.

```text
Vas a implementar UNA tarea de un proyecto Next.js + Supabase. Trabajás en ~/projects/recetario, en la rama etapa-<ETAPA>.

TAREA: <TAREA>            (ejemplo: T2.6)
ARCHIVO DE LA ETAPA: docs/plan/<ARCHIVO-ETAPA>   (ejemplo: etapa-02-recetario.md)
DISEÑO DE REFERENCIA: <DISEÑO>   (ejemplo: docs/design/pantallas/Receta.html — o "ninguno")

PASO 1 — LEER (no escribas código todavía)
a) CLAUDE.md completo.
b) docs/execution/02-codigo-deepseek.md, secciones 2 y 6.
c) En el archivo de la etapa: la tarea <TAREA> completa y las tareas que figuran en su "Depende de".
d) Las secciones de docs/SPEC.md que la tarea cita en "Spec".
e) Si hay diseño: docs/design/README.md (secciones 1 y 2) y el archivo de diseño indicado. Si no hay, la sección 3 de docs/design/README.md.
f) Los archivos que ya existen y vas a modificar o usar (componentes, esquemas, queries). Corré `git log --oneline -15` para ver qué se hizo antes.

PASO 2 — PLAN
Escribí un plan corto:
- Lista exacta de archivos a crear y a modificar.
- Para cada criterio de "Aceptación" de la tarea, cómo lo vas a cumplir.
- Dudas: si algo no está definido en el plan ni en el spec, decilo ahora y elegí la opción más simple.

PASO 3 — IMPLEMENTAR
Seguí los "Pasos" de la tarea en orden. Reglas obligatorias:
- Solo esta tarea. Nada de lo que diga "Fuera de alcance".
- No agregues dependencias que la tarea no nombre.
- Migraciones: archivo nuevo en supabase/migrations/ con RLS y policies; después `pnpm db:reset && pnpm db:types`.
- UI: mobile-first a 390 px de ancho. Igual al diseño de referencia en estructura, tamaños, espaciados y jerarquía. Colores SOLO con tokens del tema (nunca hex). Títulos con `font-display`. Íconos de lucide-react. Áreas táctiles de 44 px o más. Textos en español con voseo.
- Reutilizá los componentes existentes de components/ (Hero, PillButton, BottomNav, etc.) antes de crear nuevos.
- Copiá los patrones de la sección 6 de docs/execution/02-codigo-deepseek.md.
- Nunca escribas claves ni uses el cliente admin si la tarea no lo pide.

PASO 4 — VERIFICAR
- Corré la "Verificación" de la tarea y `pnpm check`. Si tocaste la base, también `pnpm db:test`.
- Si algo falla, arreglalo. Nunca borres ni debilites un test. Si falla 3 veces por la misma causa, frená y explicá.
- Revisá uno por uno los criterios de "Aceptación" y decí si se cumplen.

PASO 5 — CERRAR
- Marcá [x] la tarea en docs/plan/<ARCHIVO-ETAPA> y en el tablero de docs/plan/README.md.
- Si tomaste decisiones que no estaban en el plan, anotalas en "Notas de ejecución" del archivo de la etapa.
- Commit: `git add -A && git commit -m "<TAREA>: <resumen corto en inglés>"`.

RESPUESTA FINAL (en español):
1. Qué hiciste (archivos).
2. Cada criterio de aceptación: cumplido / no cumplido.
3. Resultado de las pruebas.
4. Cómo lo pruebo a mano (URL y pasos).
5. Decisiones o dudas para la revisión.
```

---

## 4. Otros prompts

### Continuar una tarea que quedó a medias

```text
La tarea <TAREA> quedó a medias en la rama etapa-<ETAPA>. Corré `git status` y `git diff` para ver lo que hay.
Leé las mismas fuentes que en el prompt de tarea (CLAUDE.md, la tarea en docs/plan/<ARCHIVO-ETAPA>, el diseño <DISEÑO>, docs/execution/02-codigo-deepseek.md §2 y §6).
Terminá la tarea respetando sus pasos y criterios de aceptación. Después seguí con los PASOS 4 y 5 del prompt de tarea.
```

### Arreglar un hallazgo de la revisión

La revisión deja tareas `TX.Y-fix-N` en `docs/reviews/etapa-XX.md`.

```text
En docs/reviews/etapa-<ETAPA>.md está la tarea <ID-FIX>. Leela completa, junto con CLAUDE.md y la tarea original que menciona.
Arreglá solo eso, sin tocar nada más. Agregá o ajustá el test que demuestre el arreglo.
Corré `pnpm check` (y `pnpm db:test` si tocaste la base). Marcá el fix como resuelto en el informe y commiteá "<ID-FIX>: <resumen>".
```

---

## 5. Tareas por etapa con su diseño de referencia

Orden de ejecución: de arriba hacia abajo dentro de cada etapa. Si una tarea no está acá, el diseño es "ninguno".

| Etapa (rama) | Archivo | Tarea → diseño de referencia |
|---|---|---|
| 1 (`etapa-01`) | `etapa-01-auth-grupos.md` | T1.1 · T1.2 · T1.3 → `Perfil.html` (solo cabecera) y §3 de design/README (login) · T1.4 · T1.5 → `Perfil.html` (lista de grupos) · T1.6 · T1.7 |
| 2 (`etapa-02`) | `etapa-02-recetario.md` | T2.1 · T2.2 · T2.3 · T2.4 · T2.5 · T2.6 → `Receta.html` · T2.7 → `Recetas.html` · T2.8 · T2.9 |
| 3 (`etapa-03`) | `etapa-03-modo-cocinar.md` | T3.1 · T3.2 → `Cocinar.html` · T3.3 → `Cocinar.html` (temporizador y chip flotante) · T3.4 · T3.5 · T3.6 → `Cocinar.html` (botón lápiz) · T3.7 · T3.8 |
| 4 (`etapa-04`) | `etapa-04-compartir.md` | T4.1 · T4.2 · T4.3 → `Receta.html` · T4.4 · T4.5 · T4.6 |
| 5 (`etapa-05`) | `etapa-05-ia-importar.md` | T5.1 · T5.2 (sin el paso 6, ya hecho en configuración) · T5.3 · T5.4 · T5.5 → `QueTenes.html` (estilo de inputs y micrófono) · T5.6 |
| 5b (`etapa-05b`) | `etapa-05b-asistente.md` | T5B.1 · T5B.2 · T5B.3 → `Asistente.html`, `Noche.html` (botón Preguntar), `Receta.html` (botón de preguntar) · T5B.4 → `CocinarPregunta.html`, `Cocinar.html` · T5B.5 |
| 6 (`etapa-06`) | `etapa-06-perfil-alimentario.md` | T6.1 · T6.2 · T6.3 · T6.4 → `Perfil.html` · T6.5 · T6.6 → `Recetas.html`, `Receta.html` · T6.7 |
| 7 (`etapa-07`) | `etapa-07-plan-semanal.md` | T7.1 · T7.2 · T7.3 → `Plan.html` · T7.4 · T7.5 → `Mediodia.html`, `Tarde.html`, `Noche.html` · T7.6 · T7.7 · T7.8 · T7.9 → `Plan.html` (chat) · T7.10 · T7.11 · T7.12 → `QueTenes.html` · T7.13 → `Opciones.html` · T7.14 |
| 8 (`etapa-08`) | `etapa-08-lista-compras.md` | T8.1 · T8.2 · T8.3 · T8.4 · T8.5 → `Compras.html` · T8.6 |
| 8b (`etapa-08b`) | `etapa-08b-plan-vivo.md` | T8B.1 · T8B.2 · T8B.3 · T8B.4 → `PlanCargar.html` · T8B.5 → `PlanVivo.html`, `Perfil.html` (tarjeta Mi plan) · T8B.6 → `PlanSeguimiento.html` · T8B.7 · T8B.8 · después **T5B.6** (archivo `etapa-05b-asistente.md`) |
| 9 (`etapa-09`) | `etapa-09-meal-prep.md` | T9.1 (la cuenta ya está configurada) · T9.2 · T9.3 → `Mediodia.html` (agenda del día) · T9.4 |
| 10 (`etapa-10`) | `etapa-10-notificaciones-pulido.md` | T10.1 (las claves VAPID ya están) · T10.2 · T10.3 · T10.4 → §3 de design/README · T10.5 · T10.6 |

Tareas marcadas 🧠 en el plan (T7.7, T7.8, T8.2): si DeepSeek falla dos veces, dejalas para Sonnet en la revisión.

---

## 6. Patrones del proyecto (copiar, no reinventar)

Estos patrones los fija la Etapa 0. Si el código existente difiere, **gana el código existente**.

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

### Página (Server Component) con tokens del tema

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

### Checklist antes del commit

- [ ] Solo toqué archivos de esta tarea.
- [ ] `pnpm check` en verde (y `pnpm db:test` si toqué la base).
- [ ] Sin hex en componentes, sin `any`, sin `console.log`.
- [ ] Textos visibles en español con voseo; estados de carga, vacío y error.
- [ ] Criterios de aceptación revisados uno por uno.
- [ ] Tarea marcada en el plan y en el tablero.
