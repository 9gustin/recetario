# Diseño — "Fuego lento"

Referencia visual para implementar la app. Copia local del canvas de diseño (https://claude.ai/artifact/B4zgaFUnFXQLHrFAkJE1zJ, privado), para que cualquier modelo o persona la pueda leer sin acceso a internet.

- Dirección visual, temas y colores: [`../SPEC.md` §8.1](../SPEC.md).
- Pantallas: [`pantallas/`](pantallas/), una por archivo, todas a **390 × 844 px** (celular).

---

## 1. Cómo leer los archivos de `pantallas/`

Son HTML con **estilos inline**. No hace falta abrirlos en el navegador: se leen como especificación.

- Ignorá `<script src="./support.js">`, las etiquetas `<x-dc>` y `<helmet>` y el bloque `<script type="text/x-dc">`: son del editor de diseño.
- `{{accent}}` = el color de acento del tema (`--accent`).
- Los textos son **contenido de ejemplo** (salmón, pollo al limón, "Casa", "18/24"). En la app salen de la base de datos.
- Las ilustraciones SVG son **placeholders** de la foto de la receta. En la app: foto de la receta (`next/image`, `object-fit: cover`) o, si no hay foto, un bloque del color `--hero` con un ícono.
- Los links entre pantallas (`href="Receta.dc.html"`) muestran **a dónde navega** cada botón.

### Cómo traducir a código

1. **Nunca copies colores hex al código.** Cada hex corresponde a un token del tema (tabla de abajo). Usá las clases de Tailwind mapeadas a tokens (`bg-background`, `bg-surface`, `text-muted`, `bg-accent`…).
2. Medidas: respetá tamaños de tipografía, radios y alturas de botones (en px del diseño = px en la app). Los paddings laterales de pantalla son 16–20 px.
3. Tipografía: textos en `'DM Serif Display'` → clase `font-display`. Todo lo demás, Inter (default).
4. Componentes repetidos (barra inferior, hero, botón píldora, tarjetas, chips) se implementan **una vez** en `components/` y se reutilizan.
5. Íconos: los SVG inline del diseño son equivalentes a íconos de `lucide-react` (sun, book, calendar, shopping-bag, user, mic, chevron-left, play, check, x, pencil, message-square, plus, search, share, heart, timer). Usá lucide.

### Tabla de tokens (hex del diseño → token)

| Hex en el diseño | Tema | Token |
|---|---|---|
| `#191411` / `#22140F` / `#F8EFE2` | noche / tarde / mediodía | `--background` |
| `#241D19` / `#331E17` / `#FFF8EE` | noche / tarde / mediodía | `--surface` |
| `#2E2520`, `#3A2E27` / `#3A241C`, `#4A2C22` / `#EAD9C2` | noche / tarde / mediodía | `--surface-2` y `--border` |
| `#F5EDE3` / `#FBEDE4` / `#2A1D14` | noche / tarde / mediodía | `--foreground` |
| `#B8A796` / `#D3AE9C` / `#6E5A48` | noche / tarde / mediodía | `--muted` |
| `#F2A541` / `#FF8A5B` / `#C9541F` (texto: `#A8431A`) | noche / tarde / mediodía | `--accent` |
| `#3A2418` / `#6E2F22` / `#F4C35A` | noche / tarde / mediodía | `--hero` |
| `#9FD08A`, `#2F6B4F` | todos | `--success` (apto, cumplido) |
| `#FF9C8A` | noche | `--danger-soft` (prohibido, sin rojos fuertes) |

Los colores de los bloques de comida (`#E0764F`, `#7FA36A`, `#E8B04B`, `#B5533B`) son placeholders de fotos.

---

## 2. Pantallas → tareas del plan

| Archivo | Pantalla | Tema | Tareas |
|---|---|---|---|
| [Mediodia.html](pantallas/Mediodia.html) | Inicio · con plan (almuerzo) | mediodía | T7.5 |
| [Tarde.html](pantallas/Tarde.html) | Inicio · sin plan (3 arranques) | tarde | T7.5 |
| [Noche.html](pantallas/Noche.html) | Inicio · con plan (cena) + botón Preguntar | noche | T0.3 (barra inferior), T7.5, T5B.3 |
| [QueTenes.html](pantallas/QueTenes.html) | ¿Qué tenés? | noche | T7.12 |
| [Opciones.html](pantallas/Opciones.html) | Ideas para hoy | tarde | T7.13 |
| [Plan.html](pantallas/Plan.html) | Plan semanal + chat con IA | tarde | T7.3, T7.9 |
| [Compras.html](pantallas/Compras.html) | Lista de compras | mediodía | T8.5 |
| [Recetas.html](pantallas/Recetas.html) | Recetario (lista, búsqueda, filtros) | mediodía | T2.7, T6.6 |
| [Receta.html](pantallas/Receta.html) | Detalle de receta | noche | T2.6, T6.6, T5B.3 |
| [Cocinar.html](pantallas/Cocinar.html) | Modo cocinar (un paso) | noche | T3.2, T3.3, T3.6, T5B.4 |
| [CocinarPregunta.html](pantallas/CocinarPregunta.html) | Preguntar mientras cocinás | noche | T5B.4 |
| [Asistente.html](pantallas/Asistente.html) | Preguntale (chat con @receta) | noche | T5B.3 |
| [Perfil.html](pantallas/Perfil.html) | Perfil y alimentación | noche | T1.3, T6.4, T8B.5 |
| [PlanCargar.html](pantallas/PlanCargar.html) | Digitalizar mi plan | tarde | T8B.4 |
| [PlanVivo.html](pantallas/PlanVivo.html) | Mi plan | noche | T8B.5 |
| [PlanSeguimiento.html](pantallas/PlanSeguimiento.html) | Registrar y seguimiento | mediodía | T8B.6 |

Cada pantalla se implementa con **los tres temas**: el diseño muestra una sola variante, pero al usar tokens se adapta sola.

## 3. Pantallas sin diseño propio

Seguí el mismo lenguaje: fondo `--background`, título serif grande arriba a la izquierda, tarjetas `--surface` con radio 16–22 px, **un solo botón principal** en píldora con `--accent`, secundarios con borde `--border`, chips redondeados, barra inferior en las pantallas de tabs.

| Pantalla | Basate en | Tarea |
|---|---|---|
| Login | Hero de `Tarde.html` (título serif + botón píldora) | T1.3 |
| Grupos, ajustes de grupo, invitar | Listas de grupos de `Perfil.html` | T1.4–T1.6 |
| Unirse por invitación `/join/[token]` | Hero de `Noche.html` con el nombre del grupo | T1.6 |
| Formulario de receta | Inputs de `Compras.html` y `QueTenes.html` | T2.5 |
| Historial de versiones | Lista de `Plan.html` | T2.8 |
| Mise en place y pantalla final del modo cocinar | `Cocinar.html` (misma estructura) | T3.2, T3.7 |
| Sheet de compartir, bandeja | Tarjetas de `Opciones.html` | T4.2, T4.4 |
| Receta pública `/r/[token]` | `Receta.html` sin barra inferior | T4.3 |
| Importar receta (menú y procesando) | `QueTenes.html` | T5.5 |
| Mi alimentación (primera vez) | Bloque del micrófono de `Perfil.html` | T6.4 |
| Preparación (meal prep) | Agenda de `Mediodia.html` | T9.3 |
| Onboarding | Hero de `Tarde.html`, una pantalla por paso | T10.4 |
