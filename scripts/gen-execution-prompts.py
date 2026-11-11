"""Genera docs/execution/prompts/etapa-XX.md: 3 prompts por etapa
(configuración con Sonnet, código con DeepSeek, revisión con Sonnet).

Uso: python3 scripts/gen-execution-prompts.py .
"""
import re, pathlib, sys

ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
PLAN = ROOT / "docs" / "plan"
OUT = ROOT / "docs" / "execution" / "prompts"
OUT.mkdir(parents=True, exist_ok=True)
for old in OUT.glob("etapa-*.md"):
    old.unlink()

D = "docs/design/pantallas/"
S3 = "docs/design/README.md §3"

# (código, archivo del plan, nombre, configuración, tareas: (id, diseño, nota))
STAGES = [
    ("01", "etapa-01-auth-grupos.md", "Auth y grupos", "google", [
        ("T1.1", None, None), ("T1.2", None, None),
        ("T1.3", D + "Perfil.html (cabecera) + " + S3 + " (login)", "los pasos 👤 de Google OAuth ya los hizo la configuración: solo código"),
        ("T1.4", None, None), ("T1.5", D + "Perfil.html (lista de grupos)", None),
        ("T1.6", S3 + " (unirse por invitación)", None), ("T1.7", None, None)]),
    ("02", "etapa-02-recetario.md", "Recetario manual", None, [
        ("T2.1", None, None), ("T2.2", None, None), ("T2.3", None, None), ("T2.4", None, None),
        ("T2.5", S3 + " (formulario de receta)", None),
        ("T2.6", D + "Receta.html", None), ("T2.7", D + "Recetas.html", None),
        ("T2.8", S3 + " (historial de versiones)", None), ("T2.9", None, None)]),
    ("03", "etapa-03-modo-cocinar.md", "Modo cocinar", None, [
        ("T3.1", None, None), ("T3.2", D + "Cocinar.html", None),
        ("T3.3", D + "Cocinar.html (temporizador y chip flotante)", None), ("T3.4", None, None), ("T3.5", None, None),
        ("T3.6", D + "Cocinar.html (botón de lápiz)", None),
        ("T3.7", S3 + " (pantalla final del modo cocinar)", None), ("T3.8", None, None)]),
    ("04", "etapa-04-compartir.md", "Compartir", None, [
        ("T4.1", None, None), ("T4.2", S3 + " (sheet de compartir)", None),
        ("T4.3", D + "Receta.html (sin barra inferior)", None),
        ("T4.4", S3 + " (bandeja)", None), ("T4.5", None, None), ("T4.6", None, None)]),
    ("05", "etapa-05-ia-importar.md", "IA: importar recetas y voz", "ia", [
        ("T5.1", None, "la API key de Anthropic ya está en .env.local; nunca la imprimas ni la escribas en archivos"),
        ("T5.2", None, "el proveedor de transcripción ya está elegido (ver Notas de ejecución); NO hagas el paso 6"),
        ("T5.3", None, None), ("T5.4", None, None),
        ("T5.5", D + "QueTenes.html (inputs y micrófono)", None),
        ("T5.6", None, "los evals llaman a la API real: corrélos una sola vez al final")]),
    ("05b", "etapa-05b-asistente.md", "Preguntale: asistente", None, [
        ("T5B.1", None, None), ("T5B.2", None, None),
        ("T5B.3", D + "Asistente.html, Noche.html (botón Preguntar), Receta.html (botón de preguntar)", None),
        ("T5B.4", D + "CocinarPregunta.html, Cocinar.html", None),
        ("T5B.5", None, "los evals llaman a la API real: corrélos una sola vez al final")]),
    ("06", "etapa-06-perfil-alimentario.md", "Perfil alimentario", None, [
        ("T6.1", None, None), ("T6.2", None, None), ("T6.3", None, None),
        ("T6.4", D + "Perfil.html", None), ("T6.5", None, None),
        ("T6.6", D + "Recetas.html, Receta.html", None), ("T6.7", None, None)]),
    ("07", "etapa-07-plan-semanal.md", "Plan semanal + Hoy", None, [
        ("T7.1", None, None), ("T7.2", None, None), ("T7.3", D + "Plan.html", None), ("T7.4", None, None),
        ("T7.5", D + "Mediodia.html, Tarde.html, Noche.html", None), ("T7.6", None, None),
        ("T7.7", None, "tarea difícil: si fallás dos veces, dejala anotada para la revisión y seguí"),
        ("T7.8", None, "tarea difícil: si fallás dos veces, dejala anotada para la revisión y seguí"),
        ("T7.9", D + "Plan.html (panel de chat)", None), ("T7.10", None, None),
        ("T7.11", None, "los evals llaman a la API real: corrélos una sola vez al final"),
        ("T7.12", D + "QueTenes.html", None), ("T7.13", D + "Opciones.html", None), ("T7.14", None, None)]),
    ("08", "etapa-08-lista-compras.md", "Lista de compras", None, [
        ("T8.1", None, None), ("T8.2", None, "tarea difícil: si fallás dos veces, dejala anotada para la revisión y seguí"),
        ("T8.3", None, None), ("T8.4", None, None), ("T8.5", D + "Compras.html", None), ("T8.6", None, None)]),
    ("08b", "etapa-08b-plan-vivo.md", "Plan vivo", None, [
        ("T8B.1", None, None), ("T8B.2", None, None), ("T8B.3", None, None),
        ("T8B.4", D + "PlanCargar.html", None),
        ("T8B.5", D + "PlanVivo.html, Perfil.html (tarjeta Mi plan)", None),
        ("T8B.6", D + "PlanSeguimiento.html", None), ("T8B.7", None, None), ("T8B.8", None, None),
        ("T5B.6", None, "está en docs/plan/etapa-05b-asistente.md: leela y marcala ahí")]),
    ("09", "etapa-09-meal-prep.md", "Meal prep y tips", "inngest", [
        ("T9.1", None, "Inngest ya está configurado: no hagas los pasos 👤"),
        ("T9.2", None, None), ("T9.3", D + "Mediodia.html (agenda del día)", None), ("T9.4", None, None)]),
    ("10", "etapa-10-notificaciones-pulido.md", "Notificaciones y pulido", "vapid", [
        ("T10.1", None, "las claves VAPID ya están: no hagas los pasos 👤"),
        ("T10.2", None, None), ("T10.3", None, None),
        ("T10.4", S3 + " (onboarding) + hero de " + D + "Tarde.html", None),
        ("T10.5", None, None), ("T10.6", None, None)]),
]

CONFIG = {
    "google": "Google OAuth (login con Google) en Google Cloud y Supabase, local y producción",
    "ia": "API key de Anthropic y proveedor de transcripción, incluida la prueba de calidad del paso 6 de T5.2",
    "inngest": "cuenta de Inngest e integración con Vercel",
    "vapid": "claves VAPID para Web Push",
}


def titles():
    t = {}
    for f in PLAN.glob("etapa-*.md"):
        for m in re.finditer(r"^### (T[0-9A-Z.]+) — (.+)$", f.read_text(encoding="utf-8"), re.M):
            t[m.group(1)] = m.group(2).replace("🧠", "").strip()
    return t


def config_prompt(code, plan_file, kind):
    if kind:
        what = (f"1. Hacé la configuración puntual de esta etapa: {CONFIG[kind]}. Seguí la fila de la Etapa {code.lstrip('0')} "
                "en la tabla de la sección C de docs/execution/01-configuracion-sonnet.md, incluida su prueba de que funciona.")
    else:
        what = "1. Esta etapa no necesita configuración externa. Verificá que main esté al día y en verde (`pnpm check`)."
    return f"""Sos el responsable de configuración del proyecto en ~/projects/recetario (WSL). Preparás la Etapa {code} para que otro agente escriba el código.

Leé CLAUDE.md, docs/execution/README.md, docs/execution/01-configuracion-sonnet.md (sección C) y docs/plan/{plan_file}.

{what}
2. Lo que se pueda dejar en el repo (supabase/config.toml, .env.example, docs/deploy.md) commitealo en main: "config(etapa-{code}): <resumen>".
3. Creá la rama de la etapa: `git checkout main && git pull && git checkout -b etapa-{code} && git push -u origin etapa-{code}`.

Reglas:
- No escribas código de la etapa.
- Los pasos en consolas web los hago yo: guiame paso a paso y esperá mi confirmación.
- Nunca me pidas claves en el chat: decime en qué archivo o panel van (.env.local, Vercel, secrets de GitHub).

Al final decime qué quedó listo y que ya puedo pasar al prompt de código."""


def code_prompt(code, plan_file, tasks, t):
    lines = []
    for i, (tid, design, note) in enumerate(tasks, start=1):
        extra = []
        if design:
            extra.append(f"diseño: {design}")
        if note:
            extra.append(f"ojo: {note}")
        suffix = f"  [{' · '.join(extra)}]" if extra else ""
        lines.append(f"{i}. {tid} — {t.get(tid, '')}{suffix}")
    task_list = "\n".join(lines)
    return f"""Vas a implementar el código de la Etapa {code} de un proyecto Next.js + Supabase. Trabajás en ~/projects/recetario, en la rama etapa-{code}.

TAREAS, EN ESTE ORDEN (archivo: docs/plan/{plan_file}):
{task_list}

ANTES DE EMPEZAR
- `git checkout etapa-{code} && git pull`, `pnpm db:start` (si no está levantada) y `git status`.
- Si existe docs/reviews/etapa-{code}.md con tareas fix sin resolver ([ ]), hacé PRIMERO esas fixes (una por una, con su test, commit "<ID-FIX>: <resumen>") y después seguí con las tareas pendientes.
- Leé una sola vez: CLAUDE.md, docs/execution/02-codigo-deepseek.md (secciones 2 y 6) y docs/design/README.md.
- Retomá desde la primera tarea de la lista que NO esté marcada [x] en el archivo de la etapa.

PARA CADA TAREA (una por vez, sin mezclar)
1. Leer: la tarea completa en el archivo de la etapa, las que figuran en su "Depende de", las secciones de docs/SPEC.md que cita y el diseño indicado entre corchetes (si no hay, docs/design/README.md §3).
2. Plan: escribí en 3 a 6 líneas qué archivos vas a crear o modificar y cómo cumplís cada criterio de "Aceptación".
3. Implementar siguiendo los "Pasos" de la tarea:
   - Solo esa tarea. Nada de "Fuera de alcance". Sin dependencias que la tarea no nombre.
   - Migraciones nuevas (nunca editar una commiteada), con RLS y policies; después `pnpm db:reset && pnpm db:types`.
   - UI mobile-first a 390 px, igual al diseño en estructura, tamaños y espaciados. Colores SOLO con tokens del tema (nunca hex), títulos con `font-display`, íconos de lucide-react, áreas táctiles ≥ 44 px, textos en español con voseo, estados de carga, vacío y error.
   - Reutilizá componentes existentes y copiá los patrones de 02-codigo-deepseek.md §6.
   - Nunca escribas claves ni uses el cliente admin si la tarea no lo pide.
4. Verificar: la "Verificación" de la tarea y `pnpm check` (y `pnpm db:test` si tocaste la base). Nunca borres ni debilites un test.
5. Cerrar: marcá [x] la tarea en su archivo de etapa y en el tablero de docs/plan/README.md, anotá decisiones en "Notas de ejecución", y `git add -A && git commit -m "<ID>: <resumen en inglés>" && git push`.
6. Escribí una línea de avance ("✅ <ID> lista: …") y pasá a la siguiente.

CUÁNDO FRENAR
- Si una tarea falla 3 veces por la misma causa (o 2 si dice "tarea difícil"): dejá el código como esté, anotá el problema en "Notas de ejecución", NO la marques [x], commiteá "<ID>: WIP - <problema>" y seguí con la siguiente tarea que no dependa de ella.
- Si algo no está definido en el plan ni en el spec y no hay una opción simple obvia: anotalo y elegí la más simple.
- Si te quedás sin contexto o la sesión se corta: me pedís que vuelva a pegar este mismo prompt; vas a retomar desde la primera tarea sin [x].

AL TERMINAR TODAS
Corré `pnpm check`, `pnpm db:test` y `pnpm test:e2e`, hacé `git push` y respondeme en español:
1. Tareas completas y tareas que quedaron WIP (con el motivo).
2. Resultado de las pruebas.
3. Decisiones tomadas fuera del plan.
4. Que ya puedo pasar al prompt de revisión."""


def review_prompt(code, plan_file, tasks):
    designs = sorted({d.split(" (")[0] for _, d, _ in tasks if d and d.startswith(D)})
    designs_txt = ", ".join(designs) if designs else "las de docs/design/README.md §3"
    return f"""Sos el revisor técnico del proyecto en ~/projects/recetario (WSL). Revisás la Etapa {code} (rama etapa-{code}) antes de que entre a main.

Seguí la sección A de docs/execution/03-revision-sonnet.md (pasos 1 a 11) con estos valores:
- Archivo de la etapa: docs/plan/{plan_file}
- Informe: docs/reviews/etapa-{code}.md
- Pantallas de diseño a comparar: {designs_txt}

Empezá leyendo CLAUDE.md, docs/execution/03-revision-sonnet.md, docs/plan/{plan_file} y `git log main..etapa-{code} --oneline`.

Importante:
- Tareas marcadas WIP o sin [x]: si son chicas, terminalas vos; si son grandes (o son tareas difíciles de lógica/IA que DeepSeek no pudo), resolvelas vos también si te alcanza esta sesión; si no, dejalas como fix en el informe.
- Si dejás fixes para DeepSeek, no mergees: el mismo prompt de código de esta etapa los resuelve primero. Después volvés a correr ESTE prompt y revisás solo lo nuevo.
- Si es una segunda pasada (ya existe el informe), verificá los fixes, repetí los pasos 2, 4 y 7, actualizá el informe y seguí al paso 10.

RESPUESTA FINAL (en español, corta):
- Veredicto: MERGEADA / BLOQUEADA (por qué).
- Pruebas: resultado de cada comando.
- Arreglos que hiciste.
- Fixes para DeepSeek (IDs), si hay.
- Qué tengo que probar yo en el celular (3 a 6 pasos)."""


def block(text):
    return "```text\n" + text + "\n```\n"


def write_stage(code, name, plan_file, p1, p2, p3, intro=""):
    md = [f"# Etapa {code} — {name}\n",
          f"Plan: [`docs/plan/{plan_file}`](../../plan/{plan_file}). Tres prompts, en orden, cada uno en una sesión nueva.{intro}\n",
          "| # | Quién | Qué |", "|---|---|---|"]
    for row in (p1[0], p2[0], p3[0]):
        md.append(row)
    md.append("")
    for title, text in (p1[1:], p2[1:], p3[1:]):
        md.append(f"## {title}\n")
        md.append(block(text))
    (OUT / f"etapa-{code}.md").write_text("\n".join(md), encoding="utf-8")


def stage0():
    plan_file = "etapa-00-fundaciones.md"
    p1 = f"""Sos el responsable de la configuración inicial del proyecto en ~/projects/recetario (WSL). El repo ya existe en GitHub (9gustin/recetario, privado) y `gh` está logueado.

Leé: CLAUDE.md, docs/execution/README.md, docs/execution/01-configuracion-sonnet.md (secciones A y B), docs/plan/README.md, docs/plan/{plan_file} y docs/SPEC.md §4.

Ejecutá en la rama main, en este orden, las tareas de configuración de la Etapa 0: T0.1, T0.5, T0.6, T0.7 y T0.8. Un commit por tarea ("T0.x: <resumen>"); marcá cada una en el plan y en el tablero.

Reglas:
- Antes de cada tarea, decime en 3 líneas qué vas a hacer; después, corré su verificación.
- T0.1: creá también AGENTS.md en la raíz con una línea: "Leé y seguí CLAUDE.md antes de hacer cualquier cosa."
- T0.5: verificá `docker info` dentro de WSL; si no responde, pedime que active la integración WSL en Docker Desktop. Copiá las claves locales de `supabase status` a .env.local (no se commitea).
- T0.6: si `playwright install --with-deps` pide sudo, pedime que lo corra yo.
- T0.7/T0.8: los pasos 👤 los hago yo (Supabase prod en São Paulo, Vercel, secrets de GitHub): guiame paso a paso y esperá mi confirmación. Nunca me pidas claves en el chat; decime en qué panel o archivo van.
- Escribí docs/deploy.md como dice T0.8.
- No hagas T0.2, T0.3 ni T0.4 (van en el prompt de código).

Al final verificá: `pnpm check`, `pnpm test:e2e`, `pnpm db:test`, CI en verde, URL de producción abriendo y /api/health con db: true. Decime qué quedó listo y cómo levanto todo desde cero."""

    p2 = f"""Vas a implementar la base visual y la estructura de la app (Etapa 0). Trabajás en ~/projects/recetario, en la rama main.

TAREAS, EN ESTE ORDEN (archivo: docs/plan/{plan_file}):
1. T0.2 — Design system base  [diseño: SPEC §8.1 + tabla de tokens de docs/design/README.md · ojo: agregá --success y --danger-soft]
2. T0.3 — App shell mobile  [diseño: la barra inferior de docs/design/pantallas/Noche.html]
3. T0.4 — PWA instalable

Leé primero: CLAUDE.md, docs/SPEC.md §8, docs/design/README.md y docs/design/pantallas/Noche.html, Mediodia.html y Tarde.html.

Para cada tarea: leé la tarea completa → plan de 3 a 6 líneas → implementá siguiendo sus "Pasos" → corré su verificación y `pnpm check` → marcá [x] en el plan y en el tablero → commit "T0.x: <resumen>" → `git push`.

Reglas: solo esas tareas; sin dependencias que la tarea no nombre; los tokens de los tres temas tienen que coincidir exactamente con SPEC §8.1; nada de hex en componentes fuera de globals.css; textos en español con voseo.

Al final decime qué hiciste, cómo lo veo (`pnpm dev` y `/dev/ui`) y las decisiones que tomaste.
(Recomendado correr este prompt con Sonnet: es la base visual de toda la app. Si preferís DeepSeek, funciona igual.)"""

    p3 = review_prompt("00", plan_file, [("", D + "Noche.html", None), ("", D + "Mediodia.html", None), ("", D + "Tarde.html", None)]).replace(
        "Revisás la Etapa 00 (rama etapa-00) antes de que entre a main.",
        "Revisás la Etapa 00 (ya está en main: no hay PR ni merge; en el paso 10 solo verificá CI y deploy).").replace(
        "`git log main..etapa-00 --oneline`", "`git log --oneline`")
    write_stage("00", "Fundaciones", plan_file,
                ("| 1 | Sonnet | Configuración: T0.1, T0.5–T0.8 (proyecto, base de datos, pruebas, CI, producción) |", "1 · Sonnet — configuración", p1),
                ("| 2 | Sonnet (recomendado) o DeepSeek | Código: T0.2–T0.4 (diseño, estructura, PWA) |", "2 · Código", p2),
                ("| 3 | Sonnet | Revisión de la etapa |", "3 · Sonnet — revisión", p3))


t = titles()
stage0()
index_rows = ["| 00 | [etapa-00.md](etapa-00.md) | Fundaciones | 3 |"]
for code, plan_file, name, kind, tasks in STAGES:
    write_stage(code, name, plan_file,
                (f"| 1 | Sonnet | {'Configuración (' + CONFIG[kind] + ')' if kind else 'Verificar main'} + crear la rama etapa-{code} |", "1 · Sonnet — configuración", config_prompt(code, plan_file, kind)),
                (f"| 2 | DeepSeek | Código: {', '.join(x[0] for x in tasks)} (todas en una sesión; si se corta, volvés a pegar el mismo prompt) |", "2 · DeepSeek — código", code_prompt(code, plan_file, tasks, t)),
                ("| 3 | Sonnet | Revisión, arreglos, merge a main y deploy. Si deja fixes: volvés al prompt 2 y después al 3 |", "3 · Sonnet — revisión", review_prompt(code, plan_file, tasks)))
    index_rows.append(f"| {code} | [etapa-{code}.md](etapa-{code}.md) | {name} | {len(tasks)} |")

index = ["# Prompts por etapa\n",
         "Cada etapa tiene **3 prompts**, en orden y cada uno en una sesión nueva:\n",
         "1. **Sonnet — configuración**: servicios externos que pida la etapa y creación de la rama.",
         "2. **DeepSeek — código**: todas las tareas de la etapa, una por una, con un commit por tarea. Si la sesión se corta, se pega el mismo prompt y retoma.",
         "3. **Sonnet — revisión**: pruebas, diseño, seguridad, arreglos, merge y deploy. Si deja fixes, se vuelve al prompt 2 (los resuelve primero) y después al 3.\n",
         "Al final de todo: revisión general en [`../03-revision-sonnet.md`](../03-revision-sonnet.md) §B.\n",
         "| Etapa | Archivo | Contenido | Tareas |", "|---|---|---|---|"] + index_rows
index.append("\nSi cambia el plan: `python3 scripts/gen-execution-prompts.py .`")
(OUT / "README.md").write_text("\n".join(index) + "\n", encoding="utf-8")
print("ok", len(STAGES) + 1)
