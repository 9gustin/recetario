import re, pathlib, sys

ROOT = pathlib.Path(sys.argv[1])
PLAN = ROOT / "docs" / "plan"
OUT = ROOT / "docs" / "execution" / "prompts"
OUT.mkdir(parents=True, exist_ok=True)

D = "docs/design/pantallas/"

STAGES = [
    # (code, plan file, name, config, tasks: list of (id, design, note, file override))
    ("01", "etapa-01-auth-grupos.md", "Auth y grupos", "google", [
        ("T1.1", None, None), ("T1.2", None, None),
        ("T1.3", D + "Perfil.html (solo la cabecera) y la sección 3 de docs/design/README.md (login)", "Los pasos 👤 de esta tarea (Google OAuth) ya los hizo la configuración: no los repitas. Solo implementá el código."),
        ("T1.4", None, None), ("T1.5", D + "Perfil.html (lista de grupos)", None),
        ("T1.6", "la sección 3 de docs/design/README.md (unirse por invitación)", None), ("T1.7", None, None)]),
    ("02", "etapa-02-recetario.md", "Recetario manual", None, [
        ("T2.1", None, None), ("T2.2", None, None), ("T2.3", None, None), ("T2.4", None, None),
        ("T2.5", "la sección 3 de docs/design/README.md (formulario de receta)", None),
        ("T2.6", D + "Receta.html", None), ("T2.7", D + "Recetas.html", None),
        ("T2.8", "la sección 3 de docs/design/README.md (historial de versiones)", None), ("T2.9", None, None)]),
    ("03", "etapa-03-modo-cocinar.md", "Modo cocinar", None, [
        ("T3.1", None, None), ("T3.2", D + "Cocinar.html", None),
        ("T3.3", D + "Cocinar.html (temporizador y chip flotante)", None), ("T3.4", None, None), ("T3.5", None, None),
        ("T3.6", D + "Cocinar.html (botón de lápiz)", None),
        ("T3.7", "la sección 3 de docs/design/README.md (pantalla final del modo cocinar)", None), ("T3.8", None, None)]),
    ("04", "etapa-04-compartir.md", "Compartir", None, [
        ("T4.1", None, None), ("T4.2", "la sección 3 de docs/design/README.md (sheet de compartir)", None),
        ("T4.3", D + "Receta.html (sin barra inferior)", None),
        ("T4.4", "la sección 3 de docs/design/README.md (bandeja)", None), ("T4.5", None, None), ("T4.6", None, None)]),
    ("05", "etapa-05-ia-importar.md", "IA: importar recetas y voz", "ia", [
        ("T5.1", None, "La API key de Anthropic ya está en .env.local (la cargó la configuración). No la imprimas ni la escribas en archivos."),
        ("T5.2", None, "El proveedor de transcripción ya está elegido y configurado (ver Notas de ejecución de la etapa). NO hagas el paso 6 (prueba de calidad): ya está hecho."),
        ("T5.3", None, None), ("T5.4", None, None),
        ("T5.5", D + "QueTenes.html (estilo de inputs y micrófono)", None),
        ("T5.6", None, "Los evals llaman a la API real: corré `pnpm eval:parse` una sola vez al final y reportá el resultado.")]),
    ("05b", "etapa-05b-asistente.md", "Preguntale: asistente", None, [
        ("T5B.1", None, None), ("T5B.2", None, None),
        ("T5B.3", D + "Asistente.html, " + D + "Noche.html (botón Preguntar) y " + D + "Receta.html (botón de preguntar)", None),
        ("T5B.4", D + "CocinarPregunta.html y " + D + "Cocinar.html", None),
        ("T5B.5", None, "Los evals llaman a la API real: corrélos una sola vez al final.")]),
    ("06", "etapa-06-perfil-alimentario.md", "Perfil alimentario", None, [
        ("T6.1", None, None), ("T6.2", None, None), ("T6.3", None, None),
        ("T6.4", D + "Perfil.html", None), ("T6.5", None, None),
        ("T6.6", D + "Recetas.html y " + D + "Receta.html", None), ("T6.7", None, None)]),
    ("07", "etapa-07-plan-semanal.md", "Plan semanal + Hoy", None, [
        ("T7.1", None, None), ("T7.2", None, None), ("T7.3", D + "Plan.html", None), ("T7.4", None, None),
        ("T7.5", D + "Mediodia.html, " + D + "Tarde.html y " + D + "Noche.html", None), ("T7.6", None, None),
        ("T7.7", None, "Tarea 🧠: si fallás dos veces, frená y dejala anotada para la revisión."),
        ("T7.8", None, "Tarea 🧠: si fallás dos veces, frená y dejala anotada para la revisión."),
        ("T7.9", D + "Plan.html (panel de chat)", None), ("T7.10", None, None), ("T7.11", None, "Los evals llaman a la API real: corrélos una sola vez al final."),
        ("T7.12", D + "QueTenes.html", None), ("T7.13", D + "Opciones.html", None), ("T7.14", None, None)]),
    ("08", "etapa-08-lista-compras.md", "Lista de compras", None, [
        ("T8.1", None, None), ("T8.2", None, "Tarea 🧠: si fallás dos veces, frená y dejala anotada para la revisión."),
        ("T8.3", None, None), ("T8.4", None, None), ("T8.5", D + "Compras.html", None), ("T8.6", None, None)]),
    ("08b", "etapa-08b-plan-vivo.md", "Plan vivo", None, [
        ("T8B.1", None, None), ("T8B.2", None, None), ("T8B.3", None, None),
        ("T8B.4", D + "PlanCargar.html", None),
        ("T8B.5", D + "PlanVivo.html y " + D + "Perfil.html (tarjeta Mi plan)", None),
        ("T8B.6", D + "PlanSeguimiento.html", None), ("T8B.7", None, None), ("T8B.8", None, None),
        ("T5B.6", None, "Esta tarea está en docs/plan/etapa-05b-asistente.md (no en el archivo de la Etapa 8b). Marcala en ese archivo.")]),
    ("09", "etapa-09-meal-prep.md", "Meal prep y tips", "inngest", [
        ("T9.1", None, "La cuenta de Inngest y sus variables ya están configuradas: no hagas los pasos 👤."),
        ("T9.2", None, None), ("T9.3", D + "Mediodia.html (agenda del día)", None), ("T9.4", None, None)]),
    ("10", "etapa-10-notificaciones-pulido.md", "Notificaciones y pulido", "vapid", [
        ("T10.1", None, "Las claves VAPID ya están en .env.local y en Vercel: no hagas los pasos 👤."),
        ("T10.2", None, None), ("T10.3", None, None),
        ("T10.4", "la sección 3 de docs/design/README.md (onboarding) y el hero de " + D + "Tarde.html", None),
        ("T10.5", None, None), ("T10.6", None, None)]),
]

CONFIG = {
    "google": "Google OAuth (login con Google) en Google Cloud y Supabase, local y producción",
    "ia": "API key de Anthropic y proveedor de transcripción, con la prueba de calidad del paso 6 de T5.2",
    "inngest": "cuenta de Inngest e integración con Vercel",
    "vapid": "claves VAPID para Web Push",
}

def titles(plan_file):
    t = {}
    for f in [plan_file, "etapa-05b-asistente.md"]:
        for m in re.finditer(r"^### (T[0-9A-Z.]+) — (.+)$", (PLAN / f).read_text(encoding="utf-8"), re.M):
            t[m.group(1)] = m.group(2).strip()
    return t

def config_prompt(code, plan_file, kind):
    if kind:
        what = f"Hacé solo la configuración puntual de esta etapa ({CONFIG[kind]}), según la tabla de la sección C de docs/execution/01-configuracion-sonnet.md. No escribas código de la etapa: eso lo hace otro agente."
    else:
        what = "Esta etapa no necesita configuración externa. Solo verificá que main esté al día y en verde (`pnpm check`)."
    return f"""Sos el responsable de configuración del proyecto en ~/projects/recetario (WSL).

Leé CLAUDE.md, docs/execution/README.md, docs/execution/01-configuracion-sonnet.md (sección C) y docs/plan/{plan_file}.

{what}

Reglas:
- Los pasos en consolas web los hago yo: guiame paso a paso y esperá mi confirmación.
- Nunca me pidas claves en el chat. Decime en qué archivo o panel van (.env.local, Vercel, secrets de GitHub, supabase/config.toml).
- Lo que se pueda dejar en el repo (config.toml, .env.example, docs/deploy.md) dejalo commiteado en main con el mensaje "config(etapa-{code}): <resumen>".
- Creá la rama etapa-{code} desde main y subila: `git checkout main && git pull && git checkout -b etapa-{code} && git push -u origin etapa-{code}`.
- Al final, verificá que la configuración funciona y decime qué quedó listo."""

def task_prompt(code, plan_file, tid, title, design, note):
    file_for_task = "etapa-05b-asistente.md" if tid == "T5B.6" else plan_file
    design_txt = design or "ninguno (seguí la sección 3 de docs/design/README.md si la tarea tiene pantallas)"
    note_txt = f"\nNOTA IMPORTANTE: {note}\n" if note else ""
    return f"""Vas a implementar UNA tarea de un proyecto Next.js + Supabase. Trabajás en ~/projects/recetario, en la rama etapa-{code}.

TAREA: {tid} — {title}
ARCHIVO DE LA ETAPA: docs/plan/{file_for_task}
DISEÑO DE REFERENCIA: {design_txt}
{note_txt}
PASO 0 — RAMA
Corré `git checkout etapa-{code} && git pull` y `git status`. Si hay cambios sin commitear que no son tuyos, frená y avisame.

PASO 1 — LEER (no escribas código todavía)
a) CLAUDE.md completo.
b) docs/execution/02-codigo-deepseek.md, secciones 2 y 6.
c) En docs/plan/{file_for_task}: la tarea {tid} completa y las tareas que figuran en su "Depende de".
d) Las secciones de docs/SPEC.md que la tarea cita en "Spec".
e) docs/design/README.md (secciones 1, 2 y 3) y el diseño de referencia indicado arriba.
f) Los archivos que ya existen y vas a modificar o usar. Corré `git log --oneline -15` para ver qué se hizo antes.

PASO 2 — PLAN
Escribí un plan corto:
- Lista exacta de archivos a crear y a modificar.
- Para cada criterio de "Aceptación" de la tarea, cómo lo vas a cumplir.
- Dudas: si algo no está definido en el plan ni en el spec, decilo ahora y elegí la opción más simple.

PASO 3 — IMPLEMENTAR
Seguí los "Pasos" de la tarea en orden. Reglas obligatorias:
- Solo esta tarea. Nada de lo que diga "Fuera de alcance".
- No agregues dependencias que la tarea no nombre.
- Migraciones: archivo nuevo en supabase/migrations/ con RLS y policies; nunca edites una migración ya commiteada; después `pnpm db:reset && pnpm db:types`.
- UI: mobile-first a 390 px de ancho. Igual al diseño de referencia en estructura, tamaños, espaciados y jerarquía. Colores SOLO con tokens del tema (nunca hex). Títulos con `font-display`. Íconos de lucide-react. Áreas táctiles de 44 px o más. Textos en español con voseo. Estados de carga, vacío y error.
- Reutilizá los componentes existentes de components/ antes de crear nuevos.
- Copiá los patrones de la sección 6 de docs/execution/02-codigo-deepseek.md (si el código existente difiere, gana el código existente).
- Nunca escribas claves ni uses el cliente admin si la tarea no lo pide.

PASO 4 — VERIFICAR
- Corré la "Verificación" de la tarea y `pnpm check`. Si tocaste la base, también `pnpm db:test`.
- Si algo falla, arreglalo. Nunca borres ni debilites un test. Si falla 3 veces por la misma causa, frená y explicá.
- Revisá uno por uno los criterios de "Aceptación" y decí si se cumplen.

PASO 5 — CERRAR
- Marcá [x] la tarea {tid} en docs/plan/{file_for_task} y en el tablero de docs/plan/README.md.
- Si tomaste decisiones que no estaban en el plan, anotalas en "Notas de ejecución" de docs/plan/{file_for_task}.
- Commit: `git add -A && git commit -m "{tid}: <resumen corto en inglés>"` y `git push`.

RESPUESTA FINAL (en español):
1. Qué hiciste (archivos).
2. Cada criterio de aceptación: cumplido / no cumplido.
3. Resultado de las pruebas.
4. Cómo lo pruebo a mano (URL y pasos).
5. Decisiones o dudas para la revisión."""

def review_prompt(code, plan_file):
    return f"""Sos el revisor técnico del proyecto en ~/projects/recetario (WSL). Revisás la Etapa {code} (rama etapa-{code}) antes de que entre a main.

Seguí al pie de la letra la sección A de docs/execution/03-revision-sonnet.md, con estos valores:
- Etapa: {code}
- Rama: etapa-{code}
- Archivo de la etapa: docs/plan/{plan_file}
- Informe: docs/reviews/etapa-{code}.md
- Pantallas de diseño: las asignadas a las tareas de esta etapa en docs/execution/prompts/etapa-{code}.md

Empezá leyendo CLAUDE.md, docs/execution/03-revision-sonnet.md y docs/plan/{plan_file}. Después hacé los pasos 1 a 11 en orden.

RESPUESTA FINAL (en español, corta):
- Veredicto: MERGEADA / BLOQUEADA (por qué).
- Pruebas: resultado de cada comando.
- Arreglos que hiciste.
- Tareas fix para DeepSeek (IDs).
- Qué tengo que probar yo en el celular (3 a 6 pasos)."""

def fix_prompt(code):
    return f"""En docs/reviews/etapa-{code}.md hay tareas fix pendientes para la rama etapa-{code}. Trabajás en ~/projects/recetario.

1. `git checkout etapa-{code} && git pull`.
2. Leé CLAUDE.md, docs/execution/02-codigo-deepseek.md (secciones 2 y 6) y el informe docs/reviews/etapa-{code}.md.
3. Resolvé SOLO la primera tarea fix que no esté marcada como resuelta. Leé también la tarea original que menciona.
4. Arreglá solo eso, sin tocar nada más. Agregá o ajustá el test que demuestre el arreglo.
5. Corré `pnpm check` (y `pnpm db:test` si tocaste la base).
6. Marcá el fix como resuelto [x] en el informe, commiteá "<ID-FIX>: <resumen>" y `git push`.
7. Decime qué arreglaste y si quedan más fixes pendientes (si quedan, pegame este mismo prompt de nuevo)."""

def recheck_prompt(code):
    return f"""Sos el revisor técnico del proyecto en ~/projects/recetario. En la rama etapa-{code} se resolvieron las tareas fix de docs/reviews/etapa-{code}.md.
Leé el informe, verificá cada fix (código + test) y repetí los pasos 2, 4 y 7 de la revisión de etapa (docs/execution/03-revision-sonnet.md, sección A).
Actualizá el informe y, si todo está en verde, seguí con el paso 10 (PR, CI, merge y deploy) y el 11."""

def block(text):
    return "```text\n" + text + "\n```\n"

index_rows = []
for code, plan_file, name, kind, tasks in STAGES:
    t = titles(plan_file)
    md = [f"# Prompts — Etapa {code}: {name}\n",
          f"Copiá y pegá cada bloque **en orden**, cada uno en una sesión nueva. Plan de la etapa: [`docs/plan/{plan_file}`](../../plan/{plan_file}).\n",
          "| Paso | Quién | Qué |\n|---|---|---|",
          f"| 1 | Sonnet (Claude Code) | {'Configuración puntual + crear rama' if kind else 'Verificar main + crear rama'} |"]
    for i, (tid, _, _) in enumerate(tasks, start=2):
        md.append(f"| {i} | DeepSeek | {tid} — {t.get(tid, '')} |")
    n = len(tasks) + 2
    md.append(f"| {n} | Sonnet (Claude Code) | Revisión de la etapa y merge |")
    md.append(f"| {n+1} | DeepSeek → Sonnet | Solo si la revisión dejó fixes |\n")
    md.append("---\n")
    md.append(f"## 1 · Sonnet — {'configuración puntual' if kind else 'preparar la rama'}\n")
    md.append(block(config_prompt(code, plan_file, kind)))
    for i, (tid, design, note) in enumerate(tasks, start=2):
        md.append(f"## {i} · DeepSeek — {tid}: {t.get(tid, '')}\n")
        md.append(block(task_prompt(code, plan_file, tid, t.get(tid, ''), design, note)))
    md.append(f"## {n} · Sonnet — revisión de la etapa\n")
    md.append(block(review_prompt(code, plan_file)))
    md.append(f"## {n+1} · Si la revisión dejó fixes\n")
    md.append("**DeepSeek** (repetir una vez por fix):\n")
    md.append(block(fix_prompt(code)))
    md.append("**Sonnet** (cuando no queden fixes):\n")
    md.append(block(recheck_prompt(code)))
    (OUT / f"etapa-{code}.md").write_text("\n".join(md), encoding="utf-8")
    index_rows.append(f"| {code} | [etapa-{code}.md](etapa-{code}.md) | {name} | {len(tasks)} |")

index = ["# Prompts listos por etapa\n",
         "Un archivo por etapa con **todos los prompts en orden**: configuración (Sonnet) → cada tarea (DeepSeek) → revisión (Sonnet) → fixes. Solo hay que copiar y pegar, cada prompt en una sesión nueva.\n",
         "La Etapa 0 se hace completa con Sonnet: sus prompts están en [`../01-configuracion-sonnet.md`](../01-configuracion-sonnet.md) §B (sesiones B1, B2 y B3).\n",
         "Para la revisión general al final de todo: [`../03-revision-sonnet.md`](../03-revision-sonnet.md) §B.\n",
         "| Etapa | Archivo | Contenido | Tareas de código |", "|---|---|---|---|",
         "| 0 | [01-configuracion-sonnet.md §B](../01-configuracion-sonnet.md) | Fundaciones (todo con Sonnet) | — |"]
index += index_rows
index.append("| Final | [03-revision-sonnet.md §B](../03-revision-sonnet.md) | Revisión general | — |")
(OUT / "README.md").write_text("\n".join(index) + "\n", encoding="utf-8")
print("ok", len(STAGES))
