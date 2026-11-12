# Etapa 4 — Compartir

**Resultado:** desde cualquier receta toco "Compartir" y la mando por link (la ven sin cuenta), la copio a otro de mis grupos o se la mando a una persona.
**Spec:** §3 F4 · §5.2 (`recipe_share_links`, `inbox_items`) · §5.3.

---

### [x] T4.1 — Migración y RPCs de compartir
- **Depende de:** T2.1
- **Archivos:** `supabase/migrations/<ts>_sharing.sql`, `supabase/tests/04_sharing.test.sql`.
- **Pasos:**
  1. Tablas `recipe_share_links` e `inbox_items` (§5.2). RLS: links visibles/creables por miembros del grupo de la receta; inbox solo del destinatario (select/update), insert solo vía RPC.
  2. `create_share_link(p_recipe_id) returns text`: reutiliza el link activo si existe; si no, crea uno con token aleatorio (`encode(gen_random_bytes(18),'base64')` → reemplazar `+/=` para que sea URL-safe).
  3. `revoke_share_link(p_recipe_id)`.
  4. `get_public_recipe(p_token) returns jsonb` (security definer, accesible a `anon`): receta + ingredientes + pasos + nombre de quien comparte (solo nombre y avatar), **sin** IDs de grupo ni de usuario. Incrementa `view_count`. Devuelve null si está revocado o la receta borrada.
  5. `fork_recipe(p_source_recipe_id uuid, p_target_group_id uuid) returns uuid`: verifica que el usuario sea miembro del grupo destino y que tenga acceso a la receta origen (miembro de su grupo **o** venga con un token válido: crear también `fork_public_recipe(p_token, p_target_group_id)`). Copia receta, ingredientes y pasos; `source_type = 'fork'`, `forked_from_recipe_id`, `forked_from_version`; crea la versión 1. Copia la imagen por referencia (misma URL).
  6. `send_recipe_to_user(p_recipe_id, p_user_id)`: solo si comparten algún grupo; crea `inbox_items` (`kind = 'recipe_shared'`, payload con `recipe_id`, título, foto).
  7. `accept_inbox_recipe(p_inbox_id, p_target_group_id)`: hace el fork y marca `resolved_at`.
- **Aceptación:** pgTAP: anon lee una receta por token válido y no por token revocado; no se puede forkear a un grupo ajeno; no se puede enviar a alguien sin grupo en común.

### T4.2 — Sheet de compartir
- **Depende de:** T4.1, T2.6
- **Archivos:** `components/recipes/share-sheet.tsx`, `lib/recipes/share-actions.ts`.
- **Pasos:**
  1. Botón "Compartir" en el detalle → sheet con tres opciones:
     - **Mandar link** → `create_share_link` → `navigator.share({ title, text: "Te paso esta receta: Pollo al limón", url })`; fallback "Copiar link". Debajo: "Cualquiera con el link la puede ver" + "Dejar de compartir".
     - **Copiar a otro grupo** → lista de mis grupos (menos el actual) → confirma → toast "Copiada a Familia" con link a la copia.
     - **Mandar a una persona** → lista de personas con las que comparto grupos (avatar + nombre, sin duplicados) → toast "Le llegó a Sofi".
- **Aceptación:** las tres opciones funcionan desde el celular.

### T4.3 — Página pública de receta
- **Depende de:** T4.1
- **Archivos:** `app/r/[token]/page.tsx`, `app/r/[token]/opengraph-image.tsx`, `app/r/[token]/cocinar/page.tsx`, `app/r/[token]/guardar/page.tsx`.
- **Pasos:**
  1. SSR con `get_public_recipe` (cliente anon). Si es null → página "Este link ya no está disponible".
  2. Vista linda y liviana: foto, título, "Compartida por Agus", tiempos, ingredientes (escalables), pasos. Banner abajo: "Guardala en tu recetario" + botón.
  3. Metadata + **imagen OpenGraph** generada (foto + título + marca) para que el preview en WhatsApp se vea bien.
  4. Botón "Cocinar" → reutiliza `cooking-stories` en modo **sin sesión** (prop `persist={false}`; sin edición).
  5. "Guardar en mi recetario" → si no hay sesión, login con `next=/r/<token>/guardar` → elegir grupo → `fork_public_recipe` → redirige a la copia.
  6. `robots: noindex`.
- **Aceptación:** abrir el link en una ventana de incógnito muestra la receta; el preview en WhatsApp muestra foto y título.

### T4.4 — Bandeja de entrada
- **Depende de:** T4.1
- **Archivos:** `app/(app)/perfil/bandeja/page.tsx`, `components/inbox/*`, badge en la tab Perfil.
- **Pasos:**
  1. Lista de ítems: "Agus te compartió *Pollo al limón*" con foto, fecha, botones "Guardar" (elige grupo → `accept_inbox_recipe`) y "Descartar".
  2. Badge con la cantidad de ítems sin resolver en la tab Perfil (consulta liviana en el layout).
  3. Diseño genérico por `kind` para sumar tipos en la Etapa 10.
- **Aceptación:** B recibe la receta de A, la guarda en su grupo y el badge desaparece.

### T4.5 — Origen de las copias
- **Depende de:** T4.1
- **Archivos:** ajustes en `components/recipes/recipe-detail/*`.
- **Pasos:** en recetas forkeadas, mostrar "Basada en *Pollo al limón* de *Casa*" (si el usuario tiene acceso al original, con link; si no, solo el texto guardado en el fork). Guardar `forked_from_title` y `forked_from_group_name` en la copia para no depender de permisos.
- **Fuera de alcance:** sincronizar cambios del original (Etapa 11+).

### T4.6 — E2E de compartir
- **Archivos:** `tests/e2e/sharing.spec.ts`.
- **Escenario:** A crea link → contexto anónimo lo abre y ve la receta → se loguea como C y la guarda en su grupo personal → A revoca → el link muestra "no disponible" · A copia la receta a otro grupo · A manda a B → B la acepta desde la bandeja.

---

## Cierre de la Etapa 4 — 🏁 MVP-1
- [ ] Deploy y prueba real: mandar una receta por WhatsApp a alguien sin cuenta.
- [ ] Revisión de seguridad 🧠 de los RPC `security definer` (tokens, fuga de IDs).
- [ ] Usar la app una semana en casa y anotar lo que molesta antes de seguir.

## Notas de ejecución

- T4.1: se agregaron `forked_from_title` y `forked_from_group_name` a `recipes` en esta migración (T4.5 pedía guardarlos en la copia: así los RPC de copia los escriben desde el principio). La copia reutiliza `save_recipe` (que valida membresía del grupo destino y deja la versión 1) desde un núcleo interno `_fork_recipe_core`, no invocable por clientes; los pasos de la copia pierden `ingredient_ids` (apuntaban a filas del original) y el modo cocinar los resuelve por texto. `get_public_recipe` es accesible por anon, devuelve solo contenido y el nombre/avatar de quien comparte, y cuenta visitas. Riesgo aceptado para la revisión de seguridad: la `image_url` de la receta es una URL pública del bucket cuyo path incluye el id del grupo y de la receta (los UUID no dan acceso, RLS lo impide). `send_recipe_to_user` exige un grupo en común; el destinatario puede aceptar aunque no sea miembro del grupo origen porque el fork corre como definer y valida que el ítem de bandeja sea suyo. 20 tests pgTAP en `04_sharing.test.sql`.
