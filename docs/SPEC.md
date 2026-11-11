# Recetario — Spec de producto y técnico

> Nombre provisorio. Versión 0.1 — 2026-11-11.
> Documento vivo: lo vamos ejecutando etapa por etapa (ver §9).

---

## 1. Visión

Resolver la comida de la semana para una casa donde todos trabajan: **tener nuestras recetas de siempre en un solo lugar, planificar la semana respetando nuestra dieta, comprar una sola vez y cocinar sin pensar**.

El producto tiene cinco grandes piezas que se encadenan:

```
 Perfil alimentario ──┐
 (voz / texto / PDF)  │
                      ▼
 Recetario del grupo ──► Plan semanal (IA + chat) ──► Lista de compras ──► Meal prep ──► Modo cocinar
 (recetas propias,        (aprobado, queda guardado)   (marcar "ya lo tengo")  (tips)      (stories paso a paso)
  compartibles)                                                                              │
        ▲                                                                                    │
        └──────────────── ajustes hechos mientras cocinás quedan en la receta ◄──────────────┘
```

### 1.1 Principios

1. **Mobile-first.** Se usa en la cocina y en el súper. Todo tiene que funcionar con una mano y con el celular apoyado en la mesada.
2. **La IA propone, la persona aprueba.** Nada de lo que genera la IA (perfil, plan, lista, receta importada) se guarda como definitivo sin una confirmación.
3. **Las restricciones son duras.** Si alguien no puede comer cebolla, ningún plan generado la incluye. Esto se valida con código, no solo con el prompt.
4. **Determinístico donde se pueda.** Sumar ingredientes, escalar porciones y armar la lista es código. La IA se usa para entender lenguaje, normalizar, sugerir y conversar.
5. **Nada se pierde.** Planes, listas y versiones de recetas quedan guardados y se pueden consultar.

### 1.2 Usuarios y caso principal

- **Persona principal:** pareja que convive, ambos trabajan, quieren comer sano y pedir menos delivery. Una de las dos personas sigue una dieta con restricciones (sin cebolla, bajo en carbohidratos, foco en proteína + verduras).
- **Caso secundario:** compartir una receta puntual con un amigo/familiar por link, o tener un grupo "Familia" además del grupo "Casa".

---

## 2. Glosario

| Término | Significado |
|---|---|
| **Usuario** | Persona con cuenta. |
| **Grupo** | Espacio compartido (ej: "Casa", "Familia Vázquez"). Tiene miembros ilimitados. Un usuario puede estar en grupos ilimitados. |
| **Grupo personal** | Grupo de un solo miembro que se crea automáticamente al registrarse ("Mis recetas"). |
| **Receta** | Pertenece a un grupo. Tiene ingredientes, pasos (con tiempos) y versiones. |
| **Fork / copia** | Cuando una receta se comparte a otro grupo, se crea una copia vinculada al original, para que cada grupo la adapte sin pisar al otro. |
| **Perfil alimentario** | Resumen estructurado de lo que la persona come, le gusta, no puede comer y qué plan sigue. Lo genera la IA a partir de voz/texto/archivos. |
| **Plan semanal** | Conjunto de comidas asignadas a días y momentos (almuerzo, cena…) para un grupo. Pasa de borrador → aprobado → archivado. |
| **Lista de compras** | Derivada de un plan aprobado (o manual). Ítems agrupados por sección del súper, con "ya lo tengo" / "comprado". |
| **Meal prep** | Tareas de preparación anticipada sugeridas a partir del plan (ej: "cortá el pollo en cubos y freezalo el domingo"). |
| **Modo cocinar** | Vista full-screen tipo historias de Instagram: un paso por pantalla, con timer. |

---

## 3. Features (spec de negocio)

Cada feature tiene: descripción, historias de usuario y criterios de aceptación. Marcado **[MVP]** lo que entra en la primera versión usable.

### F1. Cuenta y autenticación [MVP]

- Login con **Google** y con **magic link** por email (sin contraseñas).
- Al registrarse: se crea el perfil (`profiles`) y el **grupo personal**.
- Perfil básico: nombre, foto, idioma (es-AR por defecto), unidades (métrico).

**Aceptación:** puedo entrar con Google desde el celular, cerrar la app y volver sin re-loguearme.

### F2. Grupos e invitaciones [MVP]

- Crear grupo con nombre + emoji/foto.
- **Invitar por link:** genero un link (`/join/{token}`), lo comparto por WhatsApp. Quien lo abre, si no tiene cuenta se registra y queda unido; si tiene cuenta, se une directo.
- Links de invitación: vencimiento configurable (default 7 días), revocables, usos ilimitados por defecto.
- Roles: `owner` (1+), `admin`, `member`.
  - owner/admin: invitar, renombrar, expulsar, revocar links.
  - member: ver y editar recetas, planes y listas del grupo.
- Salir de un grupo. Si el último owner sale, el admin más antiguo pasa a owner; si no hay nadie, el grupo se archiva.
- Selector de grupo activo en la barra superior (la app siempre trabaja "dentro" de un grupo).

**Aceptación:** creo "Casa", mando el link a mi pareja, ella entra con su cuenta y ve las mismas recetas y planes que yo, en tiempo real.

### F3. Recetario [MVP]

**Receta** = título, foto, descripción, porciones base, tiempo de preparación/cocción/total, dificultad, etiquetas (ej: "low carb", "rápida", "freezable"), fuente (URL/persona), notas.

- **Ingredientes:** cantidad + unidad + ingrediente + preparación ("200 g de pechuga de pollo, en cubos"). Opcionales. Agrupables ("Para la salsa").
- **Pasos:** texto + **duración estimada** + tipo de tiempo (`activo` = estás haciendo algo / `pasivo` = esperar, ej: horno 25 min) + tip opcional + ingredientes usados en ese paso + foto opcional.
- **Escalar porciones:** cambiar 2 → 4 porciones recalcula cantidades.
- **Búsqueda y filtros:** por texto, etiqueta, ingrediente ("qué hago con zapallitos"), tiempo máximo, "apto para [persona]" (cruza con perfiles).
- **Versiones:** cada edición guarda una versión; se ve el historial y se puede volver atrás.
- **Favoritos y "la última vez la hicimos el…"** (desde las sesiones de cocina).
- **Compatibilidad con perfiles:** cada receta muestra un indicador por miembro del grupo: ✅ apta / ⚠️ tiene algo a limitar / ⛔ tiene algo prohibido (ej: "tiene cebolla"). Calculado con código a partir de las restricciones del perfil y los ingredientes.

**Crear receta** de cuatro formas:
1. Manual (formulario).
2. **Pegando texto o un link** → la IA la estructura (F9).
3. **Foto** de un libro/cuaderno/captura → la IA la estructura.
4. **Dictado por voz** ("hacemos pollo al limón, primero…") → la IA la estructura.

**Aceptación:** dicto una receta de 1 minuto y en < 20 s tengo un borrador con ingredientes y pasos con tiempos, que reviso y guardo.

### F4. Compartir [MVP parcial]

Tres formas, todas desde el botón **Compartir** dentro de la receta:

| Destino | Qué pasa |
|---|---|
| **Link público** | Se genera `/r/{token}`. Cualquiera lo abre sin cuenta y ve la receta (solo lectura, con modo cocinar). Botón "Guardar en mi recetario" → pide login → copia (fork) en el grupo que elija. Revocable. Share nativo del celular (Web Share API → WhatsApp, etc.). |
| **A otro grupo mío** | Copia (fork) de la receta en ese grupo, con referencia al original. |
| **A una persona** | Elijo a alguien con quien comparto algún grupo. Le llega a su **bandeja** ("Agus te compartió *Pollo al limón*") y decide en qué grupo guardarla. |

Decisión de diseño: **compartir = copiar con vínculo**, no referencia compartida. Motivo: cada casa adapta (sin cebolla, más picante). Desde la copia se ve "basada en *X* de *grupo Y*" y, en una etapa posterior, "hay cambios en el original, ¿traerlos?".

### F5. Perfil alimentario con IA

Pantalla "Contame cómo comés". Entradas, combinables y acumulativas:

- 🎙️ **Botón de hablar** (mantener o tocar para grabar). Ej: "Me gusta comer proteína y verdura, no puedo comer cebolla por un tratamiento, trato de no comer harinas a la noche, los lunes como en la oficina…"
- ⌨️ Texto libre.
- 📎 **Archivos:** PDF del plan del nutricionista, foto del papel con la dieta, captura de pantalla.
- Preguntas guiadas opcionales (la IA repregunta lo que falta: "¿Cuántas comidas hacés en casa?", "¿Tenés horno/airfryer?").

La IA produce un **perfil estructurado** + un **resumen en lenguaje natural** que la persona revisa y edita antes de guardar:

- Restricciones: ingrediente/grupo + severidad (`prohibido` / `limitar`) + motivo opcional. Ej: cebolla → prohibido (incluye cebolla de verdeo, puerro? → la IA pregunta).
- Objetivos: "bajo en carbohidratos", "alto en proteína", objetivos numéricos si el plan los tiene (ej: ≤ 50 g carbos/día).
- Gustos y rechazos, cocinas preferidas.
- Contexto de vida: tiempo disponible para cocinar en semana vs. fin de semana, qué comidas se hacen en casa, equipamiento (horno, airfryer, freezer), nivel de cocina.
- Vigencia: "esta dieta es hasta marzo" (permite planes temporales).

Cada nueva entrada **actualiza** el perfil (merge), mostrando un diff: "Agregué: no come cebolla. Cambié: cena liviana → cena sin harinas".

**Perfil del grupo:** al planificar, se combinan los perfiles de quienes comen esa comida: restricciones = **unión** (si uno no puede, nadie la come en esa comida compartida), gustos = ponderados.

> ⚠️ Disclaimer visible: la app no da consejo médico ni nutricional; ayuda a organizar un plan que ya tenés.

### F6. Plan semanal [MVP manual, IA después]

Vista semana (lunes→domingo) × momentos configurables por grupo (default: desayuno, almuerzo, merienda, cena y snacks; cada grupo puede ocultar los que no usa). Los momentos sin nada asignado se colapsan en la grilla para no ensuciar la vista.

**Manual:** arrastro/selecciono recetas a cada casilla. Puedo marcar quién come (ej: lunes almuerzo solo yo, porque ella come en la oficina), porciones, y "sobras de" (la cena del lunes rinde para el almuerzo del martes).

**Con IA (chat):** "Armame la semana". La IA:
1. Lee los perfiles de los participantes, el recetario del grupo, el historial (qué comimos las últimas semanas, para no repetir) y lo que el usuario pide ("esta semana quiero pescado dos veces, el jueves no cocinamos").
2. Propone un plan priorizando **recetas del recetario**; si faltan, propone recetas nuevas (marcadas como "nueva", se guardan solo si el plan se aprueba).
3. Tiene en cuenta:
   - **Variedad** (no milanesa con tomate todos los días; rotar proteínas, verduras y tipos de ensalada).
   - **Perecibilidad:** lo más delicado (hojas verdes, pescado) al principio de la semana; lo que dura (zapallo, repollo, congelados) al final.
   - **Batch cooking y sobras:** cocinar doble el domingo para dos comidas.
   - **Tiempo:** recetas rápidas los días de semana, las largas el fin de semana.
   - **Ingredientes compartidos** entre recetas para comprar menos y desperdiciar menos.
4. Se conversa: "cambiá el miércoles por algo con carne", "el viernes algo que no haya que cocinar". La IA modifica el borrador (diffs visibles).
5. **Aprobar** → el plan queda en estado `approved`, se genera la lista de compras (F7) y las tareas de meal prep (F8).

**Validación dura:** antes de mostrar cualquier propuesta, el servidor chequea cada receta contra las restricciones `prohibido`; si alguna viola, se descarta y se le pide a la IA que la reemplace.

**Planes guardados:** historial por semana. Puedo duplicar un plan anterior ("repetir la semana 3 de octubre").

### F6b. Inicio "Hoy": se adapta a lo que ya está decidido [MVP]

La home no es una pantalla fija: cambia según **si hay algo planeado** para la próxima comida y según **el momento del día**.

| Estado | Qué muestra |
|---|---|
| **Hay comida planeada** | La próxima comida ocupa la parte de arriba con un botón grande ("Armar el almuerzo", "Empezar a cocinar"). Debajo, el **plan de acción del día**: tareas con hora (ej. 18:00 "Pasá el salmón del freezer a la heladera"), la otra comida del día y lo que falta de la compra. |
| **No hay nada planeado** | "¿Qué comemos hoy?" con una barra para escribir o hablar ("Tengo ganas de algo con pollo…") y **tres arranques**: (1) **Elegí**: 3 ideas listas con lo que ya compraste (F15); (2) **Contame**: "¿Qué tenés en la heladera?" (F15); (3) **Planificá**: armar la semana con la IA (F6). |
| **Comida ya hecha** | Pasa a la siguiente comida del día o, si no hay más, a "Mañana" + recordatorios para esta noche. |

**Momento del día:** la app entera toma un tono según la hora local (§8.1): **mediodía** (claro, hasta las 16 h), **tarde** (atardecer, 16–20 h) y **noche** (oscuro, desde las 20 h). La "próxima comida" también se elige por hora (antes de las 15 h, el almuerzo; después, la cena).

### F15. "¿Qué tenés?" e ideas para hoy [MVP-2]

Dos formas rápidas de resolver una comida sin plan:

- **¿Qué tenés?** Cargo ingredientes como chips (escribiendo o por voz: "tengo pollo, zapallitos, huevos…") o un antojo ("algo con pollo", "algo liviano"), con filtros rápidos (menos de 30 min, sin horno, liviano). Devuelve recetas ordenadas por cuánto de lo necesario ya tengo: "Tenés todo · 20 min" o "Te falta: jengibre (opcional)". Primero recetas del recetario; si no alcanza, propone nuevas (que se guardan solo si las elijo).
- **Ideas para hoy:** 3 propuestas listas, cada una con **el motivo** ("la rúcula vence mañana", "no la comen hace 3 semanas", "rinde para el almuerzo"). Pestañas: *Con lo que compraste* (lista de compras de la semana marcada como comprada) · *Recetario* · *Nuevas*. "Otras 3 ideas" pide más.
- Siempre filtradas por las restricciones de quienes comen (F5) y por el plan vivo de cada uno (F14).
- **Elegir** una idea la agrega al plan de hoy (crea el plan de la semana si no existe) y la home pasa al estado "hay comida planeada".

### F7. Lista de compras [MVP]

- Se genera desde un plan aprobado: **suma de ingredientes** de todas las recetas × porciones, con normalización de unidades (300 g + 0,5 kg → 800 g) y agrupado por **sección** (verdulería, carnicería, almacén, lácteos, congelados, limpieza).
- **Cantidades de compra realistas:** "2 pechugas (~800 g)", "1 atado de rúcula", "1 docena de huevos" (IA + catálogo).
- Por ítem: ☐ comprado · "ya lo tengo" (se tacha y va al final) · nota · reasignar sección.
- Ítems manuales ("papel de cocina").
- **Duración / conservación** por ítem: "la rúcula dura 3–4 días en la heladera → comprar la que va lunes/martes; para el jueves comprar otra vez o cambiar por repollo". Opción **dividir en 2 compras** (inicio de semana + mitad de semana) cuando hay perecederos para el final.
- Tiempo real: si mi pareja tacha algo en el súper, lo veo al instante.
- Compartir lista como texto (WhatsApp).

### F8. Meal prep y tips

A partir del plan aprobado, la IA genera **tareas de preparación** con día sugerido y duración:

- "Domingo (40 min): cortá 1,2 kg de pollo en cubos, porcioná en 3 bolsas y freezá 2."
- "Lavá y secá las hojas verdes, guardalas con papel de cocina en un táper: duran 4–5 días."
- "Cociná 4 huevos duros para los almuerzos del lunes y martes."
- "Miércoles a la noche: pasá al freezer → heladera el pescado del jueves."

Las tareas aparecen en la vista "Hoy" del día correspondiente, se marcan como hechas y se pueden agregar como recordatorio (notificación push).

También: **tips de conservación** por ingrediente (catálogo, F11) y sugerencias de **variedad** ("esta semana tenés tomate 4 veces; probá una ensalada de repollo con zanahoria y yogur").

### F9. Importar / estructurar recetas con IA

Entrada: texto, URL, foto o audio → **receta estructurada** (mismo esquema que F3) con:
- Ingredientes normalizados y vinculados al catálogo.
- Pasos separados (uno por acción), **duración estimada** y tipo (activo/pasivo), tips.
- Etiquetas sugeridas y compatibilidad con los perfiles del grupo.
- "Adaptar a mi perfil": versión sin cebolla / low carb (crea una variante, no pisa la original).

### F10. Modo cocinar (stories) [MVP]

Desde una receta o desde la vista "Hoy" → **Cocinar**.

1. **Pantalla 0 — Mise en place:** porciones (escalables), lista de ingredientes con checks, utensilios, tiempo total estimado.
2. **Un paso por pantalla**, full-screen:
   - Barra de progreso segmentada arriba (como historias).
   - Texto grande, ingredientes del paso con cantidades, tip.
   - **Timer** si el paso tiene tiempo: iniciar / pausar / +1 min. Si es pasivo ("horneá 25 min"), al iniciarlo podés avanzar al siguiente paso y el timer sigue en un chip flotante; al terminar suena + vibra + notificación.
   - Botón grande **"Listo ✓"** → siguiente paso. Tap izquierda = anterior, swipe.
3. **Pantalla se mantiene encendida** (Wake Lock API).
4. **Editar en curso:** en cualquier paso, "✏️ Ajustar" (cambiar texto, tiempo, cantidad, agregar paso). Al terminar: "Guardaste 2 cambios: ¿actualizar la receta?" → crea nueva versión.
5. **Final:** "¡Listo!" → rating (1–5), nota ("la próxima, menos sal"), foto del plato. Queda en el historial de sesiones.
6. Retomar: si cierro la app, al volver sigue en el paso donde estaba.
7. (Etapa posterior) Control por voz: "siguiente", "repetí", "¿cuánto falta?".

### F11. Catálogo de ingredientes (soporte interno)

Tabla global (no por grupo) con: nombre canónico, sinónimos regionales (palta/aguacate, zapallito/calabacín, morrón/pimiento), sección del súper, unidad por defecto, peso por unidad aproximado (1 cebolla ≈ 150 g), **vida útil** (heladera / freezer / alacena, en días), tips de conservación, macros aproximados por 100 g (para chequear "bajo en carbohidratos"), alérgenos/grupos ("allium" incluye cebolla, puerro, verdeo, ajo? → configurable).

Se siembra inicialmente con ~300 ingredientes comunes en Argentina (generado con IA + revisión) y crece solo: cuando aparece un ingrediente nuevo, la IA propone su ficha.

### F12. Bandeja y notificaciones (post-MVP)

- Bandeja: recetas que me compartieron, invitaciones, "tu pareja aprobó el plan".
- Push (PWA): recordatorios de meal prep, "sacá el pescado del freezer", timers de cocina.

### F13. Heladera / despensa (post-MVP, opcional)

Inventario simple: lo comprado pasa a "en casa" con fecha estimada de vencimiento. La vista "Hoy" avisa "la rúcula vence mañana". El plan con IA prioriza usar lo que ya hay.

### F14. Plan vivo: seguir el plan de la nutricionista

Los planes de nutricionista suelen llegar como un PDF largo y difícil de seguir. El **plan vivo** los convierte en algo simple y diario. Es por persona (vive en su perfil, F5) y es privado.

1. **Digitalizar:** cargo lo que tenga: PDF, fotos, un audio contando el plan, texto. La IA lo resume en una estructura clara:
   - **Comidas por momento del día** (desayuno, almuerzo, merienda, cena, colaciones) con su "fórmula" (ej. cena = proteína + verduras, sin harinas) y opciones concretas.
   - **Porciones** cuando el plan las tiene (½ taza de arroz, 150 g de proteína).
   - **Reglas** (carbohidratos solo al mediodía, 2 L de agua, etc.) y **prohibidos/limitados** (se vuelcan como restricciones del perfil F5).
   - **Permitidos** con su tope (ej. 3 por semana) y qué cuenta como permitido.
   - **Vigencia** (semana 3 de 8, próximo control).
   - Me muestra el resumen y lo que no entendió como preguntas.
2. **Ajustar charlando:** "no me gusta el yogur del desayuno" → la IA propone **reemplazos equivalentes** que respetan la regla de esa comida (ej. queso untable + 2 huevos). Elijo uno y queda guardado como **reemplazo** del plan. Puedo volver a ajustar cuando quiera; cada cambio queda en un historial (versiones del plan).
3. **Seguirlo:** pantalla **Mi plan** con "Hoy toca" (cada comida con su fórmula y, si hay plan semanal, la receta que la cumple), % cumplido de la semana, permitidos usados/restantes y mis reemplazos.
4. **Registrar:** cada comida se registra con un toque: **Cumplí** · **Cambié algo** · **Usé un permitido**. Opcional: contar qué comí (texto o voz); la IA lo clasifica contra la regla de esa comida y sugiere el estado. Si al cocinar en modo cocinar una receta del plan semanal, se registra sola como "Cumplí" (con opción de corregir).
5. **Seguimiento:** grilla semanal (comidas × días) con colores por estado, % de cumplimiento, permitidos restantes hasta el domingo y un mensaje corto y positivo. Historial por semana para llevar a la nutricionista (exportable como texto/PDF).
6. **Integración:** el plan vivo actúa como regla para el plan semanal con IA (F6), las ideas del día y "¿Qué tenés?" (F15): solo propone comidas que encajan en la fórmula del momento del día para esa persona.

> El tono es de acompañamiento y nunca reta a la persona: sin rojos de "fallaste", los permitidos son parte del plan. Disclaimer: la app organiza el plan que te dieron; no lo reemplaza ni da indicaciones médicas.

### F16. Preguntale: asistente de cocina [MVP-2]

Un chat con IA para sacarse dudas en cualquier momento, que **conoce el contexto de la casa**: recetas del grupo, perfil y plan vivo de quien pregunta, plan de la semana, lista de compras y catálogo de ingredientes (vida útil, conservación).

**Dónde aparece**
- **Inicio:** botón "Preguntar" arriba a la derecha (también en el estado sin plan, junto a la barra de texto/voz).
- **Detalle de receta:** "Preguntar por esta receta" abre el chat con la receta ya citada.
- **Modo cocinar:** botón de pregunta en cada paso. Abre un panel sobre el paso actual; el asistente sabe **qué receta, qué paso, las porciones y los timers activos**. Pensado para manos ocupadas: botón grande "Tocá y hablá", respuesta corta y opción de **respuesta en voz alta** (síntesis de voz del navegador).

**Citar recetas con @**
- Escribir `@` abre un buscador de recetas del grupo; elegir una inserta un chip (`@Pollo al limón con zapallitos`). Se pueden citar varias ("¿qué combina mejor con @Salmón: @Ensalada de repollo o @Puré de calabaza?").
- Por voz: "arroba pollo al limón…" o simplemente nombrar la receta; el asistente la resuelve y la muestra como chip para confirmar.

**Qué responde**
- Sobre una receta: reemplazos y agregados ("¿le puedo poner brócoli?"), cuánto dura, si se puede freezar y cómo, con qué acompañarla, cómo escalarla, qué hacer si algo salió mal.
- Generales: conservación y freezer, vencimientos ("¿esto sigue bien?"), combinaciones, técnicas, equivalencias de medidas.
- Siempre respetando las restricciones de quien pregunta (si sugiere un agregado, chequea compatibilidad) y su plan vivo.

**Acciones desde el chat** (siempre con confirmación, nunca automáticas):
- "Sumarlo a la receta" → crea una versión nueva con el cambio (como en F10).
- "Agregar a la lista de compras", "Agregar al plan de hoy", "Anotar en la receta" (nota).

**Seguridad alimentaria:** en dudas de vencimiento o conservación responde de forma conservadora ("ante la duda, no"), con señales concretas a revisar, y nunca da indicaciones médicas.

**Historial:** las conversaciones quedan guardadas por usuario (privadas); las preguntas hechas desde una receta quedan accesibles desde esa receta ("Preguntas sobre esta receta").

### Fuera de alcance (por ahora)

Conteo calórico detallado, integración con supermercados online, app nativa en stores, monetización, red social pública de recetas.

---

## 4. Arquitectura técnica

### 4.1 Decisiones de stack

| Capa | Elección | Por qué |
|---|---|---|
| App | **Next.js (App Router) + TypeScript** | Un solo repo para frontend y API; SSR para los links públicos de recetas (preview lindo en WhatsApp). |
| UI | **Tailwind CSS + shadcn/ui**, Framer Motion para el modo stories | Rápido de construir, buen resultado mobile. |
| Formato de app | **PWA instalable** (no app nativa todavía) | Se instala en el home del celular, push notifications, wake lock, sin pasar por stores. Si después hace falta nativa: Expo reutilizando la API. |
| Base de datos | **Supabase Postgres** | Postgres real + Auth + Storage + Realtime + Row Level Security en un solo servicio. |
| Acceso a datos / migraciones | **Migraciones SQL** (Supabase CLI) + `supabase-js` con **tipos generados**. Sin ORM. | Una sola fuente de verdad del esquema; RLS, triggers y funciones se escriben naturalmente en SQL; menos piezas para un agente que ejecuta el plan. |
| Auth | **Supabase Auth** (Google OAuth + magic link) | Integrado con RLS. |
| Archivos | **Supabase Storage** (buckets: `recipe-images`, `profile-inputs`, `audio`) | Mismo proveedor, URLs firmadas. |
| Tiempo real | **Supabase Realtime** | Lista de compras y plan sincronizados entre la pareja. |
| IA (LLM) | **Claude API** — `claude-sonnet-5-5` para plan semanal/chat y perfil; `claude-haiku-5-5` para tareas chicas (normalizar ingredientes, etiquetar). Salidas estructuradas vía *tool use* con JSON Schema. | Lee PDFs e imágenes nativamente (plan del nutricionista, foto de receta). |
| Voz → texto | API de transcripción (ej. OpenAI `gpt-4o-transcribe` o Deepgram), detrás de una interfaz `Transcriber` intercambiable | Claude no transcribe audio. Web Speech API del navegador como fallback gratis (inconsistente en iOS). |
| Jobs largos | **Inngest** (o Vercel Queues) | Generar plan + lista + meal prep puede tardar > 30 s; jobs con reintentos y progreso. |
| Hosting | **Vercel** (app) + **Supabase región São Paulo** (`sa-east-1`) | Baja latencia desde Argentina; free tiers suficientes para empezar. |
| Observabilidad | Sentry (errores) + PostHog (analytics de producto) + tabla `ai_runs` (costos/latencia IA) | |
| Validación | **Zod** compartido entre forms, API y salidas de IA | Un solo esquema por entidad. |
| Testing | Vitest (unit), Playwright (e2e mobile viewport), tests de RLS con pgTAP o scripts | |
| CI | GitHub Actions: lint, typecheck, tests, migraciones en preview branch de Supabase | |

### 4.2 Diagrama

```
 ┌──────────── Celular (PWA) ────────────┐
 │ Next.js client · Service Worker       │
 │ Wake Lock · MediaRecorder · Web Share │
 └───────────────┬───────────────────────┘
                 │ HTTPS
 ┌───────────────▼────────────────────── Vercel ──────────────────────┐
 │ Next.js Server Components / Route Handlers / Server Actions        │
 │  ├─ /api/ai/*  ──► Claude API (Sonnet / Haiku)                     │
 │  │             ──► Transcripción (voz)                             │
 │  ├─ Inngest functions (plan → lista → meal prep)                   │
 │  └─ /r/[token] (receta pública, SSR + OpenGraph image)             │
 └───────────────┬────────────────────────────────────────────────────┘
                 │
 ┌───────────────▼──────── Supabase (sa-east-1) ──────────┐
 │ Postgres (+RLS) · Auth · Storage · Realtime            │
 └────────────────────────────────────────────────────────┘
```

### 4.3 Estructura del repo

La estructura detallada está en [`CLAUDE.md`](../CLAUDE.md). Rutas principales:

```
/app
  /(auth)/login
  /(app)/g/[groupId]/hoy
  /(app)/g/[groupId]/recetas, /recetas/[id], /recetas/[id]/cocinar
  /(app)/g/[groupId]/plan, /plan/[weekStart]
  /(app)/g/[groupId]/compras/[listId]
  /(app)/perfil, /perfil/alimentacion, /perfil/bandeja
  /(app)/grupos, /grupos/[id]
  /join/[token]          (aceptar invitación)
  /r/[token]             (receta pública)
  /api/...               (route handlers)
/lib
  /supabase (clientes + tipos generados)
  /schemas (Zod)
  /ai (cliente, modelos, prompts, runStructured, agente del plan)
  /domain (escalado, unidades, compatibilidad receta↔perfil, validatePlan, armado de lista)
  /transcription
/inngest
/supabase/migrations, /supabase/tests
/tests (e2e, evals)
```

**Regla:** la lógica de negocio (escalar, sumar unidades, validar restricciones) vive en `/lib/domain`, pura y testeada, sin depender de la IA ni de la DB.

---

## 5. Modelo de datos

Postgres. Todas las tablas con `id uuid default gen_random_uuid()`, `created_at`, `updated_at`. Abajo, las columnas relevantes.

### 5.1 Diagrama de entidades

```
profiles ─┬─< group_members >── groups ─┬─< recipes ─┬─< recipe_ingredients >── ingredients
          │                             │            ├─< recipe_steps
          │                             │            ├─< recipe_versions
          │                             │            ├─< recipe_share_links
          │                             │            └─< cooking_sessions
          │                             ├─< group_invites
          │                             ├─< meal_plans ─┬─< meal_plan_entries >── recipes
          │                             │               ├─< prep_tasks
          │                             │               └─< ai_conversations ─< ai_messages
          │                             └─< shopping_lists ─< shopping_list_items >── ingredients
          ├── food_profiles
          ├─< food_profile_inputs
          └─< inbox_items
```

### 5.2 Tablas

#### Identidad y grupos

```sql
profiles (
  id uuid pk references auth.users,
  display_name text, avatar_url text,
  locale text default 'es-AR',
  personal_group_id uuid references groups
)

groups (
  id uuid pk, name text not null, emoji text, image_url text,
  is_personal boolean default false,
  meal_slots text[] default '{breakfast,lunch,merienda,dinner,snack}',   -- momentos del día que planifica
  week_starts_on smallint default 1,            -- 1 = lunes
  created_by uuid references profiles,
  archived_at timestamptz
)

group_members (
  group_id uuid references groups, user_id uuid references profiles,
  role text check (role in ('owner','admin','member')),
  joined_at timestamptz,
  primary key (group_id, user_id)
)

group_invites (
  id uuid pk, group_id uuid, token text unique,   -- 32+ chars aleatorios
  created_by uuid, expires_at timestamptz,
  max_uses int null, uses int default 0, revoked_at timestamptz
)
```

#### Recetas

```sql
recipes (
  id uuid pk, group_id uuid not null references groups,
  created_by uuid references profiles,
  title text not null, description text, image_url text,
  servings numeric not null default 2,
  prep_minutes int, cook_minutes int, total_minutes int,
  difficulty text check (difficulty in ('facil','media','dificil')),
  tags text[] default '{}',
  source_type text check (source_type in ('manual','text','url','photo','voice','ai_generated','fork')),
  source_url text,
  forked_from_recipe_id uuid references recipes,   -- vínculo al original al compartir
  forked_from_version int,
  current_version int default 1,
  is_favorite boolean default false,               -- (o tabla recipe_favorites por usuario)
  storage_info jsonb,    -- {"fridge_days":3,"freezer_days":60,"reheat":"..."} para meal prep
  search_tsv tsvector,   -- full-text search (español)
  deleted_at timestamptz
)

ingredients (                       -- catálogo global
  id uuid pk, name text unique,     -- canónico, singular: 'cebolla'
  aliases text[],                   -- {'cebolla blanca','cebolla morada'}
  family text[],                    -- {'allium'}  para restricciones por familia
  aisle text,                       -- 'verduleria','carniceria','almacen','lacteos','congelados','pescaderia','otros'
  default_unit text,                -- 'g','ml','unidad'
  unit_weight_g numeric,            -- peso de 1 unidad
  shelf_life jsonb,                 -- {"fridge":[3,5],"freezer":[60,90],"pantry":null}
  storage_tips text,
  nutrition_per_100g jsonb,         -- {"kcal":..,"protein":..,"carbs":..,"fat":..}
  created_by_ai boolean, reviewed boolean
)

recipe_ingredients (
  id uuid pk, recipe_id uuid, ingredient_id uuid null references ingredients,
  raw_text text,                -- '200 g de pechuga de pollo en cubos'
  quantity numeric null, unit text null,
  preparation text,             -- 'en cubos'
  section text,                 -- 'Para la salsa'
  optional boolean default false,
  position int
)

recipe_steps (
  id uuid pk, recipe_id uuid, position int,
  instruction text not null,
  duration_seconds int null,
  timer_kind text check (timer_kind in ('active','passive')) null,
  tip text, image_url text,
  ingredient_ids uuid[]          -- recipe_ingredients usados en el paso
)

recipe_versions (
  id uuid pk, recipe_id uuid, version int,
  snapshot jsonb not null,       -- receta completa (ingredientes + pasos) en esa versión
  changed_by uuid, change_note text,
  origin text check (origin in ('edit','cooking_session','ai_adapt','restore')),
  unique (recipe_id, version)
)

recipe_share_links (
  id uuid pk, recipe_id uuid, token text unique,
  created_by uuid, revoked_at timestamptz, view_count int default 0
)

inbox_items (
  id uuid pk, user_id uuid, kind text,   -- 'recipe_shared','group_invite','plan_approved'
  payload jsonb, from_user_id uuid, read_at timestamptz, resolved_at timestamptz
)
```

#### Perfil alimentario

```sql
food_profiles (
  user_id uuid pk references profiles,
  summary text,                    -- resumen en lenguaje natural, editable
  data jsonb not null,             -- estructura validada (ver §6.2)
  version int default 1,
  valid_until date null
)

food_profile_inputs (              -- fuentes crudas (auditables / re-procesables)
  id uuid pk, user_id uuid,
  kind text check (kind in ('voice','text','file')),
  storage_path text,               -- audio/pdf/imagen en Storage
  transcript text,                 -- texto (o transcripción)
  processed_at timestamptz, ai_run_id uuid
)
```

#### Planificación

```sql
meal_plans (
  id uuid pk, group_id uuid, week_start date,
  status text check (status in ('draft','approved','archived')),
  title text, notes text,
  created_by uuid, approved_by uuid, approved_at timestamptz,
  generation_context jsonb         -- qué pidió el usuario, perfiles usados (snapshot)
)

meal_plan_entries (
  id uuid pk, plan_id uuid,
  date date, slot text,            -- 'lunch','dinner',...
  recipe_id uuid null,             -- null si es "comemos afuera" / texto libre
  free_text text,
  servings numeric,
  diner_ids uuid[],                -- quiénes comen
  cook_date date,                  -- se cocina otro día (batch)
  leftovers_of_entry_id uuid null, -- es sobra de otra entrada
  is_new_recipe boolean default false,   -- receta propuesta por IA, se confirma al aprobar
  position int
)

prep_tasks (
  id uuid pk, plan_id uuid,
  title text, details text,
  suggested_date date, duration_minutes int,
  kind text,                       -- 'batch_cook','cut','marinate','thaw','wash','portion'
  related_entry_ids uuid[],
  done_at timestamptz, done_by uuid,
  remind_at timestamptz
)

cooking_sessions (
  id uuid pk, recipe_id uuid, recipe_version int,
  user_id uuid, plan_entry_id uuid null,
  servings numeric, current_step int,
  started_at timestamptz, finished_at timestamptz,
  rating smallint, note text, photo_url text,
  pending_edits jsonb               -- ajustes hechos durante la sesión
)
```

#### Compras

```sql
shopping_lists (
  id uuid pk, group_id uuid, plan_id uuid null,
  name text, status text check (status in ('active','done','archived')),
  shop_date date                    -- permite dividir en 2 compras por semana
)

shopping_list_items (
  id uuid pk, list_id uuid, ingredient_id uuid null,
  display_name text,                -- 'Pechuga de pollo'
  quantity numeric, unit text,
  purchase_hint text,               -- '2 pechugas (~800 g)'
  aisle text,
  state text check (state in ('pending','bought','have_it')) default 'pending',
  state_by uuid, state_at timestamptz,
  note text, is_manual boolean,
  needed_by date,                   -- primera fecha en que se usa
  shelf_life_warning text,          -- 'dura 3 días: comprar el lunes'
  source_entry_ids uuid[],
  position int
)
```

#### Plan vivo (F14)

```sql
diet_plans (
  id uuid pk, user_id uuid references profiles,
  title text,                       -- 'Plan de la nutricionista'
  status text check (status in ('draft','active','archived')),
  starts_on date, ends_on date, next_checkup date,
  rules jsonb,                      -- reglas generales: [{"text":"Carbohidratos solo al mediodía","kind":"carbs_timing", ...}]
  allowances jsonb,                 -- {"per_week":3,"definition":"una comida libre o un postre"}
  summary text,
  version int default 1,
  source_input_ids uuid[]           -- food_profile_inputs usados (PDF, audio…)
)

diet_plan_meals (                   -- "fórmula" por momento del día
  id uuid pk, plan_id uuid, slot text,          -- 'breakfast','lunch','merienda','dinner','snack'
  days smallint[] null,                         -- null = todos los días
  formula text,                                 -- 'Proteína + verduras, sin harinas'
  components jsonb,                             -- [{"group":"proteina","portion":"150 g"},{"group":"carbohidrato","portion":"½ taza","allowed":true}]
  options jsonb,                                -- opciones concretas del PDF
  position int
)

diet_plan_swaps (                   -- reemplazos elegidos por la persona
  id uuid pk, plan_id uuid, meal_id uuid null,
  original text, replacement text, reason text,
  created_at timestamptz
)

diet_plan_versions (id, plan_id, version int, snapshot jsonb, change_note text, created_at)

meal_logs (                         -- registro diario
  id uuid pk, user_id uuid, plan_id uuid,
  date date, slot text,
  status text check (status in ('followed','changed','allowance','skipped')),
  note text,                        -- "comí una tarta de verdura"
  ai_suggested_status text,
  plan_entry_id uuid null,          -- si vino de una comida del plan semanal
  cooking_session_id uuid null,
  unique (user_id, date, slot)
)
```

RLS: todo solo para el propio usuario. Lo único visible para el grupo son las restricciones derivadas (vía `get_group_diet`) y, para planificar, la **fórmula por momento del día** (vía un RPC `get_group_meal_rules`), nunca el registro ni el PDF.

#### IA (trazabilidad)

```sql
ai_conversations (
  id, group_id, user_id,
  purpose text,                     -- 'plan_chat','diet_plan','assistant'
  plan_id uuid null,
  context jsonb,                    -- asistente: {"recipe_ids":[...],"cooking_session_id":..,"step":4,"origin":"home|recipe|cooking"}
  title text, last_message_at timestamptz
)
ai_messages      (id, conversation_id, role text, content jsonb, mentions uuid[], created_at)
ai_runs (                           -- cada llamada al modelo
  id, user_id, group_id, feature text, model text,
  input_tokens int, output_tokens int, latency_ms int,
  status text, error text, created_at
)
```

### 5.3 Seguridad (RLS)

- Función `is_group_member(gid uuid)` → `exists(select 1 from group_members where group_id = gid and user_id = auth.uid())`.
- Toda tabla con `group_id` (directo o vía padre): `select/insert/update/delete` solo si `is_group_member`.
- Acciones de administración (invitar, expulsar) solo `owner/admin`.
- `food_profiles` / `food_profile_inputs`: lectura y escritura solo del propio usuario. **Excepción:** los miembros de un grupo en común pueden leer `data.restrictions` y `data.goals` (vía vista `group_member_diet` con `security definer`), **no** los archivos ni transcripciones originales — pueden contener info médica.
- Recetas públicas (`/r/{token}`) y unirse por invitación (`/join/{token}`): se resuelven en el servidor con service role, validando token, vencimiento y revocación. Nunca se exponen IDs internos.
- `ingredients`: lectura pública, escritura solo servidor.
- Rate limiting en endpoints de IA y de tokens (por usuario/IP).

---

## 6. IA: diseño de cada capacidad

Patrón común:
1. El servidor arma el contexto (datos de DB, nunca confía en lo que manda el cliente).
2. Llama a Claude con un **tool/JSON Schema** de salida (derivado de Zod).
3. Valida con Zod; si falla, un reintento con el error.
4. **Validadores de dominio** (restricciones, unidades) corren después.
5. Se guarda como **borrador**; el usuario confirma.
6. Se registra en `ai_runs`.

Prompts en `/lib/ai/prompts/*.ts`, versionados, en español rioplatense.

### 6.1 Voz

Cliente graba con `MediaRecorder` (webm/opus o mp4 en iOS) → sube a Storage → `/api/transcribe` → transcripción → se usa como texto en el flujo correspondiente. Límite inicial: 5 min por audio. El audio se borra a los 30 días (configurable).

### 6.2 Perfil alimentario — `POST /api/ai/food-profile/ingest`

Entrada: texto/transcripción + archivos (PDF/imagen pasan directo al modelo) + perfil actual.
Salida:

```jsonc
{
  "summary": "Comés principalmente proteína y verduras...",
  "restrictions": [
    {"target": "cebolla", "type": "ingredient", "severity": "forbidden", "reason": "tratamiento", "includes": ["cebolla de verdeo","echalote"]},
    {"target": "harinas refinadas", "type": "category", "severity": "limit", "limit": "evitar en la cena"}
  ],
  "goals": [{"kind": "low_carb", "detail": "≤ 50 g carbohidratos/día", "numeric": {"carbs_g_per_day_max": 50}}],
  "likes": ["pollo", "pescado blanco", "zapallitos"],
  "dislikes": ["hígado"],
  "cuisines": ["casera argentina", "asiática"],
  "schedule": {"weekday_cook_minutes_max": 30, "meals_at_home": {"mon":["dinner"], "tue":["lunch","dinner"]}},
  "equipment": ["horno", "airfryer", "freezer"],
  "skill": "intermedio",
  "valid_until": null,
  "open_questions": ["¿El ajo también está prohibido o solo la cebolla?"],
  "changes": [{"op": "add", "path": "restrictions", "text": "No come cebolla"}]
}
```

`open_questions` se muestran como preguntas para responder (texto o voz) antes de guardar.

### 6.3 Estructurar receta — `POST /api/ai/recipes/parse`

Entrada: texto | URL (el servidor descarga y extrae; si hay JSON-LD `schema.org/Recipe`, se usa primero sin IA) | imagen | transcripción.
Salida: receta con `ingredients[]` (`raw_text, quantity, unit, name_canonical, preparation, optional`) y `steps[]` (`instruction, duration_seconds, timer_kind, tip, ingredient_refs`). Luego `/lib/domain/ingredients.match()` vincula con el catálogo (exacto → alias → fuzzy trigram → IA Haiku crea ficha nueva).

### 6.4 Plan semanal — chat con herramientas

`POST /api/ai/plans/{planId}/chat` (streaming). El modelo tiene tools:

| Tool | Hace |
|---|---|
| `search_recipes(query, tags, max_minutes, exclude_ids)` | Busca en el recetario del grupo (ya filtrado por compatibilidad). |
| `get_recent_meals(weeks)` | Qué se comió para evitar repetir. |
| `get_participants_profiles()` | Perfiles combinados de quienes comen. |
| `get_ingredient_info(names[])` | Vida útil, sección, macros. |
| `propose_recipe(recipe)` | Crea receta nueva en borrador (si no hay en el recetario). |
| `set_plan(entries[])` / `update_entries(changes[])` | Escribe el borrador del plan. |

Después de cada `set_plan/update_entries`, el servidor corre `validatePlan()`:
- ⛔ ingredientes prohibidos para cualquier comensal de esa comida → rechaza con mensaje al modelo.
- ⚠️ límites (ej: carbos estimados por día > objetivo) → advertencia visible.
- Variedad: misma proteína > N veces, misma receta repetida → advertencia al modelo.
- Perecibilidad: ingrediente con vida útil < días hasta su uso → sugerencia (mover o dividir compra).

El cliente ve el plan actualizarse en vivo en la grilla mientras se conversa.

### 6.5 Lista de compras — `POST /api/plans/{id}/shopping-list`

1. **Determinístico:** recorrer entradas → escalar ingredientes por porciones (`servings_entry / servings_recipe`) → normalizar unidades (g/kg, ml/l, unidades→g con `unit_weight_g`) → agrupar por `ingredient_id` → sumar → `needed_by` = fecha mínima de uso.
2. **IA (Haiku), solo para presentación:** convertir cantidades a formatos de compra (`purchase_hint`), resolver ítems sin `ingredient_id`, y generar `shelf_life_warning` / sugerir dividir en dos compras.
3. Se crea `shopping_lists` (+ opcionalmente una segunda con `shop_date` a mitad de semana).

### 6.6 Meal prep — job después de aprobar el plan

Entrada: plan aprobado + recetas + catálogo (vida útil) + equipamiento + tiempo disponible.
Salida: `prep_tasks[]` con `suggested_date`, `duration_minutes`, `kind`, `related_entry_ids`, más `tips[]` generales de la semana. Regla: ninguna preparación anticipada puede superar la vida útil del ingrediente preparado hasta su uso.

### 6.7 Plan vivo — digitalizar y ajustar

- `POST /api/ai/diet-plan/ingest`: PDF/imágenes como bloques de documento/imagen + transcripciones → `DietPlanDraft` (comidas por momento con fórmula, porciones y opciones; reglas; permitidos; vigencia; restricciones para F5; `open_questions`). Se guarda como `draft` hasta que la persona lo confirma.
- `POST /api/ai/diet-plan/:id/chat`: conversación para ajustar. Tools: `propose_swaps(meal_id, dislike)` → 3 reemplazos que respetan `components` de esa comida; `apply_swap`, `update_meal`, `update_rule`. Cada cambio aplicado crea una versión.
- `POST /api/ai/meal-logs/classify`: texto libre de lo que comí + fórmula de esa comida → estado sugerido (`followed` / `changed` / `allowance`) con una frase de explicación (Haiku).
- Validación por código: los reemplazos no pueden incluir prohibidos del perfil; el conteo de permitidos es determinístico (`lib/domain/adherence.ts`).

### 6.8 "¿Qué tenés?" e ideas del día

- `POST /api/ai/suggest` con `{ mode: "have" | "ideas", ingredients?, craving?, filters, diners, slot, date }`.
- Paso determinístico primero: buscar en el recetario por cobertura de ingredientes (`have`) o por señales (`ideas`: perecederos comprados que vencen pronto, recetas no comidas hace tiempo, sobras posibles), filtrando por compatibilidad (F5) y por la fórmula del plan vivo (F14) de cada comensal.
- La IA (Haiku) ordena, redacta el **motivo** de cada idea y, si hay menos de 3 candidatas, propone recetas nuevas (borrador `status = 'draft'`).

### 6.9 Preguntale — asistente con contexto

- `POST /api/ai/assistant/chat` (streaming SSE). Input: `{ conversationId?, message, mentions: recipeId[], context?: { origin, cookingSessionId?, step? } }`.
- El servidor arma el contexto inicial: recetas citadas (completas), si viene del modo cocinar la receta + paso actual + porciones + timers, y un resumen corto de restricciones del usuario.
- Tools (con el cliente del usuario, respetan RLS): `get_recipe(id)`, `search_recipes(query)`, `get_ingredient_info(names)` (vida útil, conservación, familia), `check_compatibility(recipe_id, changes)`, `get_today()` (plan del día y lista activa), `get_my_diet_plan()`, y acciones que **solo proponen** (devuelven una tarjeta que el usuario confirma): `propose_recipe_change`, `propose_add_to_list`, `propose_add_to_plan`.
- Modelo: `MODELS.fast` por defecto; `MODELS.smart` si la pregunta involucra varias recetas o el plan (heurística simple por cantidad de menciones/tools). En modo cocinar se pide respuesta de ≤ 3 oraciones.
- System prompt: voseo, breve, práctico; seguridad alimentaria conservadora; nunca consejo médico; si propone un ingrediente, verificar compatibilidad antes.
- Voz: entrada con `VoiceRecorder`/transcripción; salida opcional con `speechSynthesis` (es-AR si está disponible).
- Cuota `assistant` (ej. 100 mensajes/día por usuario).

### 6.10 Costos y límites

- Cache de prompts para el system prompt + catálogo.
- Haiku para todo lo que es transformación chica; Sonnet solo en perfil y plan.
- Cuotas por usuario/día configurables (ej. 10 generaciones de plan/día) para evitar sorpresas.
- Dashboard interno sobre `ai_runs`.

---

## 7. API (resumen)

Server Actions para CRUD simple; Route Handlers para IA, streaming y webhooks.

```
Auth / grupos
  POST   /api/groups                         crear grupo
  POST   /api/groups/:id/invites             crear link de invitación
  DELETE /api/groups/:id/invites/:inviteId   revocar
  POST   /api/invites/:token/accept          unirse
  DELETE /api/groups/:id/members/:userId     expulsar / salir
Recetas
  GET    /api/groups/:id/recipes?q=&tags=&maxMinutes=&compatibleWith=
  POST   /api/groups/:id/recipes             crear (manual o desde borrador IA)
  PATCH  /api/recipes/:id                    editar → nueva versión
  GET    /api/recipes/:id/versions           historial
  POST   /api/recipes/:id/versions/:v/restore
  POST   /api/recipes/:id/share-link         link público
  POST   /api/recipes/:id/copy               { targetGroupId }  (fork)
  POST   /api/recipes/:id/send               { userId }  → inbox
  GET    /r/:token                           página pública (SSR)
IA
  POST   /api/transcribe
  POST   /api/ai/recipes/parse
  POST   /api/ai/recipes/:id/adapt           { profileUserIds }
  POST   /api/ai/food-profile/ingest
  POST   /api/ai/plans/:id/chat              (stream)
  POST   /api/ai/suggest                     ¿qué tenés? / ideas del día
  POST   /api/ai/diet-plan/ingest            digitalizar plan
  POST   /api/ai/diet-plan/:id/chat          ajustar plan (stream)
  POST   /api/ai/meal-logs/classify          clasificar lo que comí
  POST   /api/ai/assistant/chat              asistente (stream) con @recetas y contexto
  GET    /api/ai/assistant/conversations     historial (filtrable por receta)
Plan vivo
  GET    /api/diet-plan                      plan activo + hoy + adherencia
  PUT    /api/meal-logs                      { date, slot, status, note }
  GET    /api/meal-logs?week=                grilla semanal
Planes y compras
  POST   /api/groups/:id/plans               { weekStart }  borrador vacío
  PATCH  /api/plans/:id/entries              edición manual
  POST   /api/plans/:id/approve              → dispara job (lista + meal prep)
  POST   /api/plans/:id/duplicate            { weekStart }
  GET    /api/groups/:id/today               vista Hoy
  PATCH  /api/shopping-items/:id             { state }
Cocina
  POST   /api/recipes/:id/cooking-sessions
  PATCH  /api/cooking-sessions/:id           paso actual, ediciones
  POST   /api/cooking-sessions/:id/finish    rating, nota, aplicar cambios
```

---

## 8. Pantallas (mobile)

Navegación inferior (5 tabs): **Hoy · Recetas · Plan · Compras · Perfil**. Selector de grupo arriba.

### 8.1 Dirección visual: "Fuego lento"

Diseño de referencia (canvas con todas las pantallas): https://claude.ai/artifact/B4zgaFUnFXQLHrFAkJE1zJ (privado; compartirlo desde el menú Share si otra persona lo necesita).

- **Tipografía:** DM Serif Display para títulos y nombres de recetas; Inter para todo lo demás.
- **Hero:** la pantalla principal de cada sección abre con un bloque grande de color con ilustración o foto de la receta, título serif y **un solo botón principal** en forma de píldora.
- **Tonos por momento del día** (toda la app, según la hora local; tokens CSS por tema, cambian solos):

| Tema | Horario | Fondo | Superficie | Texto | Acento | Hero |
|---|---|---|---|---|---|---|
| `mediodia` | hasta 16 h | `#F8EFE2` | `#FFF8EE` | `#2A1D14` | `#C9541F` | `#F4C35A` |
| `tarde` | 16–20 h | `#22140F` | `#331E17` | `#FBEDE4` | `#FF8A5B` | `#6E2F22` |
| `noche` | desde 20 h | `#191411` | `#241D19` | `#F5EDE3` | `#F2A541` | `#3A2418` |

- El modo cocinar usa siempre el tema `noche` (menos brillo, mejor contraste en la cocina).
- Se puede fijar un tema a mano en Perfil (automático / mediodía / tarde / noche).
- Íconos de trazo (lucide), sin emojis en la UI. Áreas táctiles ≥ 44 px.

### 8.2 Pantallas

0. **Preguntale (F16):** accesible desde Hoy (botón "Preguntar"), desde el detalle de receta y desde cada paso del modo cocinar (panel sobre el paso, con "Tocá y hablá").
1. **Hoy:** según F6b: con comida planeada (hero + plan de acción del día) o sin plan ("¿Qué comemos hoy?" + tres arranques).
   - **¿Qué tenés?** y **Ideas para hoy** (F15).
2. **Recetas:** buscador, filtros (chips), grilla con foto + tiempo + indicadores de compatibilidad por persona. FAB "+" → Manual / Pegar texto o link / Foto / Dictar.
3. **Detalle de receta:** foto, porciones ±, ingredientes, pasos, compatibilidad, historial, botones **Cocinar**, **Compartir**, **Agregar al plan**, ✏️.
4. **Modo cocinar:** stories (F10).
5. **Plan:** semana actual / navegación por semanas; grilla días × momentos; botón **"Armar con IA"** abre panel de chat (bottom sheet) con la grilla visible; **Aprobar**.
6. **Compras:** lista por sección, swipe derecha = comprado, swipe izquierda = ya lo tengo; avisos de vida útil; compartir como texto.
7. **Perfil:** mis datos, **Mi alimentación** (botón de hablar grande, subir archivos, resumen editable, restricciones como chips), tarjeta **Mi plan** (F14), mis grupos, bandeja.
   - **Digitalizar mi plan:** subir PDF/foto/audio → resumen → chat para ajustar con reemplazos.
   - **Mi plan:** hoy toca, % cumplido, permitidos, reemplazos, "Registrar lo que comí".
   - **Registrar:** Cumplí / Cambié algo / Permitido + grilla semanal.
8. **Grupo:** miembros, invitar (link + compartir), ajustes (momentos del día, inicio de semana).
9. **Receta pública** `/r/:token`: vista linda sin login + "Guardar en mi recetario".

---

## 9. Plan de desarrollo por etapas

> Resumen. El plan ejecutable, tarea por tarea, está en [`docs/plan/`](plan/README.md).

Cada etapa termina con algo **usable en producción** (deploy en Vercel) y criterios de aceptación verificables. Estimaciones orientativas para 1 dev part-time con asistencia de IA.

### Etapa 0 — Fundaciones (≈ 1 semana)

- Repo Next.js + TS + Tailwind + shadcn/ui + ESLint/Prettier.
- Proyecto Supabase (sa-east-1) + entornos `dev` y `prod`; migraciones SQL + tipos generados.
- Deploy a Vercel con preview por PR; GitHub Actions (lint, typecheck, test).
- PWA: manifest, íconos, service worker básico, instalable.
- Layout mobile con tab bar, tipografía y los **tres temas por momento del día** (§8.1).
- Sentry + PostHog.

✅ La app vacía se instala en el celular desde la URL de producción.

### Etapa 1 — Auth y grupos (≈ 1 semana)

- Login Google + magic link; `profiles` + grupo personal automático (trigger).
- CRUD de grupos, selector de grupo activo.
- Invitaciones por link (crear, compartir con Web Share, aceptar, revocar, vencimiento).
- Roles y RLS + tests de RLS (un usuario de otro grupo no puede leer nada).

✅ Creo "Casa", mi pareja se une por link desde su celular.

### Etapa 2 — Recetario manual (≈ 2 semanas)

- Esquema `recipes`, `recipe_ingredients`, `recipe_steps`, `recipe_versions`, `ingredients`.
- Seed del catálogo de ingredientes (~300, generado con IA y revisado).
- Formulario de receta (ingredientes con parser simple "200 g pollo", pasos con duración).
- Detalle, escalado de porciones, imagen (Storage), favoritos.
- Búsqueda full-text en español + filtros.
- Versionado en cada edición + historial + restaurar.

✅ Cargamos nuestras 10 recetas de siempre y las encontramos rápido.

### Etapa 3 — Modo cocinar (≈ 1,5 semanas)

- Stories full-screen con barra segmentada, gestos, mise en place.
- Timers activos/pasivos, chip flotante, sonido + vibración, Wake Lock.
- Persistir sesión (retomar), edición en curso → "¿actualizar receta?" → nueva versión.
- Cierre con rating/nota/foto.

✅ Cocino una receta completa desde el celular sin tocar otra pantalla; un ajuste hecho en el momento queda en la receta.

### Etapa 4 — Compartir (≈ 1 semana)

- Link público `/r/:token` con SSR + OpenGraph image (preview en WhatsApp).
- "Guardar en mi recetario" (fork) con login.
- Copiar a otro grupo; enviar a persona → bandeja.

✅ Le paso una receta a mi vieja por WhatsApp, la ve sin cuenta y la puede guardar.

**🏁 Hito MVP-1 (≈ 6–7 semanas):** recetario compartido de la casa + cocinar + compartir. Ya se usa todos los días.

### Etapa 5 — IA: importar recetas + voz (≈ 1,5 semanas)

- Infra IA: cliente Claude, schemas Zod → tools, reintentos, `ai_runs`, rate limit.
- Transcripción (interfaz `Transcriber` + proveedor elegido) y componente "botón de hablar".
- Parse de texto, URL (JSON-LD primero), foto y voz → borrador → revisar → guardar.
- Matching de ingredientes con catálogo (+ ficha nueva por IA).
- Estimación de tiempos por paso.

✅ Foto de una receta del cuaderno → receta cargada con pasos y timers en < 1 min.

### Etapa 5b — Preguntale: asistente (≈ 1,5 semanas)

- Chat con streaming, menciones `@receta`, historial.
- Contexto de receta y del paso actual en modo cocinar; voz de entrada y respuesta en voz alta.
- Tools de consulta (recetas, ingredientes, compatibilidad) y acciones propuestas con confirmación.

✅ Mientras cocino pregunto por voz "¿puedo usar manteca en vez de aceite?" y recibo una respuesta corta sobre ese paso.

### Etapa 6 — Perfil alimentario (≈ 1,5 semanas)

- Pantalla "Mi alimentación": voz, texto, archivos (PDF/imagen).
- Ingest con IA → diff → preguntas abiertas → guardar.
- Vista de restricciones para el grupo (sin exponer archivos).
- `/lib/domain/compatibility`: receta ↔ perfil (familias de ingredientes, prohibido/limitar) + indicadores en recetas + filtro "apto para".
- "Adaptar receta a mi perfil" (variante).

✅ Ella graba 1 minuto contando su dieta; las recetas con cebolla aparecen marcadas ⛔ para ella.

### Etapa 7 — Plan semanal (≈ 2,5 semanas)

- 7a. Plan manual: grilla, agregar recetas, comensales, sobras/batch, aprobar, historial, duplicar semana, vista **Hoy** con sus estados (con plan / sin plan, F6b).
- 7b. Plan con IA: chat con tools (§6.4), streaming, grilla en vivo, `validatePlan()` con restricciones duras, variedad y perecibilidad.
- 7c. Arranques sin plan: **¿Qué tenés?** e **Ideas para hoy** (F15).
- Realtime para que ambos vean el mismo borrador.

✅ "Armame la semana, el jueves comemos afuera, quiero pescado una vez" → plan válido sin cebolla, low carb, sin repetir, aprobado en < 5 min de charla.

### Etapa 8 — Lista de compras (≈ 1,5 semanas)

- Agregación determinística (escalado + unidades + suma) con tests exhaustivos.
- Formatos de compra y avisos de vida útil (IA Haiku), división en 2 compras.
- UI por secciones, estados comprado / ya lo tengo, ítems manuales, realtime, compartir como texto.

✅ Aprobamos el plan y en el súper vamos tachando entre los dos en tiempo real.

**🏁 Hito MVP-2 (≈ 14–15 semanas):** el ciclo completo perfil → plan → compras → cocinar.

### Etapa 8b — Plan vivo (≈ 2 semanas)

- Digitalizar el plan de la nutricionista (PDF/foto/audio) → estructura por momento del día, reglas, permitidos.
- Chat para ajustar con reemplazos equivalentes; versiones del plan.
- Mi plan: hoy toca, % cumplido, permitidos. Registro de comidas con un toque + clasificación con IA.
- Integración con plan semanal, ideas del día y "¿Qué tenés?".

✅ Subimos el PDF de la nutricionista y en 5 minutos tenemos un plan que se sigue y se registra día a día.

### Etapa 9 — Meal prep y tips (≈ 1 semana)

- Job post-aprobación (Inngest): `prep_tasks` + tips de la semana.
- Tareas en "Hoy", marcar hechas, recordatorios.
- Sugerencias de variedad (ensaladas, guarniciones) usando el catálogo.

### Etapa 10 — Notificaciones y pulido (≈ 1,5 semanas)

- Web Push (recordatorios de meal prep, "sacá del freezer", timers con app en segundo plano).
- Bandeja completa; offline de recetas y lista (cache del service worker).
- Accesibilidad, performance, onboarding (primer grupo + primeras recetas + perfil).

### Etapa 11+ — Futuro

Heladera/despensa (F13), control por voz en modo cocinar, sincronizar cambios del original en recetas forkeadas, macros estimados por día, app nativa con Expo, importar desde Instagram/TikTok.

### Resumen

| Etapa | Contenido | Semanas aprox. | Acumulado |
|---|---|---|---|
| 0 | Fundaciones | 1 | 1 |
| 1 | Auth y grupos | 1 | 2 |
| 2 | Recetario | 2 | 4 |
| 3 | Modo cocinar | 1,5 | 5,5 |
| 4 | Compartir | 1 | 6,5 — **MVP-1** |
| 5 | IA importar + voz | 1,5 | 8 |
| 5b | Preguntale (asistente) | 1,5 | 9,5 |
| 6 | Perfil alimentario | 1,5 | 11 |
| 7 | Plan semanal + Hoy + ¿Qué tenés? | 3,5 | 14,5 |
| 8 | Lista de compras | 1,5 | 16 — **MVP-2** |
| 8b | Plan vivo | 2 | 18 |
| 9 | Meal prep | 1 | 19 |
| 10 | Notificaciones y pulido | 1,5 | 20,5 |

---

## 10. Calidad y testing

- **Dominio puro con tests unitarios fuertes:** parser de ingredientes, conversión de unidades, escalado, agregación de lista, compatibilidad receta↔perfil, `validatePlan`.
- **Evals de IA:** set de ~30 casos fijos (recetas para parsear, perfiles para extraer, pedidos de plan) con chequeos automáticos (¿aparece cebolla? ¿los pasos tienen tiempos? ¿el JSON valida?). Se corren al cambiar prompts o modelo.
- **E2E (Playwright, viewport mobile):** unirse por invitación, crear receta, cocinar, aprobar plan, tachar lista.
- **RLS:** tests que intentan leer/escribir datos de otro grupo y deben fallar.

## 11. Riesgos

| Riesgo | Mitigación |
|---|---|
| La IA incluye un ingrediente prohibido | Validación por código con familias de ingredientes + rechazo automático; ingredientes no reconocidos se tratan como "a revisar". |
| Info sensible (dietas médicas) | RLS estricto, archivos privados, solo restricciones visibles al grupo, borrar fuentes cuando el usuario quiera, disclaimer. |
| Costos de IA | Haiku por defecto, cache de prompts, cuotas por usuario, `ai_runs`. |
| iOS + PWA (push, audio, wake lock) | Probar en iOS desde la Etapa 0; push requiere app instalada en el home; fallback de timers con sonido en primer plano. |
| Unidades/cantidades ambiguas ("un chorrito") | Cantidad nula permitida; no se suman, se listan aparte. |

## 12. Decisiones

### Tomadas (2026-11-11)

| # | Tema | Decisión |
|---|---|---|
| 1 | Momentos del día | Por defecto: **desayuno, almuerzo, merienda, cena y snacks**. Cada grupo oculta los que no usa. |
| 2 | Edición de recetas | **Cualquier miembro del grupo** puede editar. El historial de versiones permite ver quién cambió qué y volver atrás. |
| 3 | "Sin cebolla" vs. ajo/verdeo/puerro | No se asume. El catálogo agrupa cebolla, verdeo, puerro, echalote y ajo en la familia `allium`. Al cargar el perfil, la IA pregunta (`open_questions`) qué miembros de la familia están prohibidos, y solo se guardan los que la persona confirme. |
| 4 | Transcripción | Se decide en la Etapa 5 con una prueba en español rioplatense (OpenAI vs. Deepgram), detrás de la interfaz `Transcriber`. |
| 5 | Dirección visual | **"Fuego lento"** (§8.1): títulos serif, hero grande con un botón principal, tres temas según el momento del día. |
| 6 | Home | Se adapta: con comida planeada muestra el plan de acción; sin plan ofrece tres arranques (elegí / ¿qué tenés? / planificá). |
| 7 | Plan de nutricionista | Se digitaliza como **plan vivo** por persona, con reemplazos, permitidos y registro diario (F14). |
| 8 | Asistente | Un solo chat "Preguntale" (F16) con contexto, accesible desde la home, la receta y cada paso del modo cocinar; cita recetas con `@`; las acciones que modifican algo siempre se confirman. |

### Abiertas

1. **Nombre y dominio.** No bloquea el desarrollo: el código usa `recetario` como nombre interno y la marca se cambia en un solo lugar (`/lib/brand.ts`). Candidatos: Sobremesa, Olla, Alacena, Hornalla, Cucharón, Mesa.
