# Etapa 3 — Modo cocinar (stories)

**Resultado:** toco "Cocinar" y la receta se abre a pantalla completa como historias de Instagram: un paso por pantalla, con timers, la pantalla no se apaga, y si ajusto algo mientras cocino queda guardado para la próxima.
**Spec:** §3 F10 · §5.2 (`cooking_sessions`).

---

### T3.1 — Migración: sesiones de cocina
- **Depende de:** T2.1
- **Archivos:** `supabase/migrations/<ts>_cooking_sessions.sql`, `supabase/tests/03_cooking.test.sql`.
- **Pasos:** tabla `cooking_sessions` (§5.2) con RLS por grupo de la receta; select/update solo de las sesiones propias (`user_id = auth.uid()`), salvo lectura de `finished_at` y `rating` para miembros del grupo (para mostrar "la última vez la hicieron el…"). Vista o RPC `recipe_last_cooked(recipe_id)`.
- **Aceptación:** `pnpm db:test` en verde.

### T3.2 — Motor de stories
- **Depende de:** T2.6
- **Archivos:** `app/(app)/g/[groupId]/recetas/[id]/cocinar/page.tsx`, `components/cooking/cooking-stories.tsx`, `components/cooking/use-cooking-reducer.ts` + test, `components/cooking/progress-segments.tsx`, `components/cooking/step-card.tsx`, `components/cooking/mise-en-place.tsx`.
- **Pasos:**
  1. Ruta full-screen (sin barra inferior ni superior): botón ✕ arriba a la derecha con confirmación "¿Salir? Tu progreso queda guardado".
  2. `useCookingReducer`: estado `{ index, completed: Set<number>, servings }`; acciones `NEXT`, `PREV`, `GOTO`, `COMPLETE`, `SET_SERVINGS`. Las pantallas son: `[mise-en-place, ...pasos, final]`. Reducer puro y testeado.
  3. Barra de progreso segmentada arriba (un segmento por pantalla; completados llenos, el actual resaltado).
  4. **Mise en place:** porciones escalables, ingredientes con checks, tiempo total estimado, botón "Empezar".
  5. **Paso:** número "Paso 3 de 8", instrucción en tipografía grande (≥ 22 px), ingredientes del paso con cantidades escaladas (`recipe_steps.ingredient_ids`), tip en una tarjeta, duración. Botón grande abajo **"Listo ✓"** → `COMPLETE` + `NEXT`.
  6. Gestos: tap en el tercio izquierdo = anterior, tap en el tercio derecho = siguiente (sin completar), swipe horizontal con Framer Motion. Teclas ← → en desktop.
  7. Transición suave entre pasos (slide).
- **Aceptación:** se recorre una receta entera con una mano.
- **Fuera de alcance:** timers (T3.3), persistencia (T3.5).

### T3.3 — Timers
- **Depende de:** T3.2
- **Archivos:** `components/cooking/timers/timer-store.ts` (zustand) + test, `components/cooking/timers/step-timer.tsx`, `components/cooking/timers/floating-timers.tsx`, `lib/sound.ts`.
- **Pasos:**
  1. Store con varios timers simultáneos: `{ id, stepIndex, label, endsAt, pausedRemaining, status }`. Basado en **timestamps** (`endsAt`), no en contar ticks, para que sobreviva a la app en segundo plano. Persistir en `localStorage`.
  2. En el paso: si tiene duración, botón "Iniciar 25:00" → cuenta regresiva grande; pausar, +1 min, reiniciar.
  3. Paso **pasivo** ("Horneá 25 min"): al iniciar, aparece el texto "Podés seguir con el próximo paso" y el timer pasa a un **chip flotante** visible en todas las pantallas (tocar → vuelve a ese paso).
  4. Al terminar: sonido (Web Audio, generado, sin archivos externos), `navigator.vibrate`, toast persistente "¡Listo el horno!" y `Notification` si el permiso fue concedido (pedirlo la primera vez que se inicia un timer, con explicación previa).
- **Aceptación:** con dos timers corriendo y la pantalla bloqueada 1 minuto, al volver el tiempo restante es correcto.

### T3.4 — Pantalla siempre encendida
- **Depende de:** T3.2
- **Archivos:** `lib/hooks/use-wake-lock.ts`.
- **Pasos:** pedir `navigator.wakeLock.request('screen')` al entrar al modo cocinar; volver a pedirlo en `visibilitychange`; liberarlo al salir. Si no hay soporte, mostrar una vez el aviso "Tu celular puede apagar la pantalla; subí el tiempo de bloqueo mientras cocinás".
- **Aceptación:** en Android Chrome y iOS Safari (17.4+) la pantalla no se apaga durante 5 minutos.

### T3.5 — Persistir y retomar la sesión
- **Depende de:** T3.1, T3.2
- **Archivos:** `lib/cooking/actions.ts`, ajustes en `cooking-stories.tsx`.
- **Pasos:**
  1. Al tocar "Empezar" se crea la sesión (`recipe_version`, `servings`, `plan_entry_id` si viene por query param).
  2. Cada cambio de paso actualiza `current_step` (debounce 1 s; si no hay red, reintenta).
  3. Al abrir "Cocinar" con una sesión sin terminar de menos de 12 h: "Seguís en el paso 4. ¿Continuar o empezar de nuevo?".
- **Aceptación:** cerrar la PWA a mitad y volver retoma el mismo paso.

### T3.6 — Ajustar la receta mientras cocino
- **Depende de:** T3.5
- **Archivos:** `components/cooking/edit-step-sheet.tsx`, `lib/domain/apply-cooking-edits.ts` + test.
- **Pasos:**
  1. Botón ✏️ en cada paso → sheet para: editar texto, cambiar duración, cambiar cantidad de un ingrediente del paso, agregar un paso después, borrar el paso.
  2. Los cambios se guardan en `cooking_sessions.pending_edits` (lista de operaciones) y se ven aplicados en la sesión al instante.
  3. `applyCookingEdits(recipeSnapshot, edits)`: función pura que devuelve la receta modificada. Tests con cada tipo de operación.
- **Aceptación:** el cambio se ve de inmediato y no toca la receta hasta el final (T3.7).

### T3.7 — Pantalla final
- **Depende de:** T3.6
- **Archivos:** `components/cooking/finish-screen.tsx`, `lib/cooking/actions.ts`.
- **Pasos:**
  1. "¡Listo! 🎉" + tiempo real que tardaste.
  2. Si hay `pending_edits`: resumen ("Cambiaste 2 cosas: horno 25 → 30 min, + 1 paso") con "Guardar en la receta" (→ `save_recipe` con `origin = 'cooking_session'` y `change_note` automático) o "Solo por esta vez".
  3. Rating 1–5 (opcional), nota ("la próxima, menos sal"), foto del plato (opcional; si la receta no tiene foto, ofrecer usarla como portada).
  4. `finished_at` y vuelta al detalle. En el detalle aparece "La última vez: 12/11, ⭐ 4" y las notas de sesiones anteriores.
- **Aceptación:** una edición hecha cocinando aparece como versión nueva con origen "mientras cocinaba".

### T3.8 — Tests del modo cocinar
- **Archivos:** `tests/e2e/cooking.spec.ts`.
- **Escenario:** abrir Cocinar → mise en place → avanzar con "Listo" y con tap → iniciar timer de un paso pasivo (con `page.clock` para adelantar el tiempo) → chip flotante → editar duración de un paso → terminar → guardar en receta → ver la versión nueva.

---

## Cierre de la Etapa 3
- [ ] Prueba real: cocinar una receta completa desde el celular.
- [ ] Verificado en iOS y Android: wake lock, sonido, vibración (iOS no vibra: está bien).

## Notas de ejecución
