# Etapa 10 — Notificaciones y pulido

**Resultado:** la app avisa lo importante (preparaciones, descongelar, timers), funciona sin señal en el súper, tiene un onboarding amable y está lista para que la use más gente.
**Spec:** §3 F12 · §11 (riesgos iOS/PWA).

---

### T10.1 — Web Push
- **Depende de:** T9.3 · 👤 generar claves VAPID (`pnpm dlx web-push generate-vapid-keys`) y cargarlas en Vercel.
- **Archivos:** migración `push_subscriptions (id, user_id, endpoint unique, keys jsonb, user_agent, created_at)`, `lib/push/{send,subscribe}.ts`, handlers `push` y `notificationclick` en `app/sw.ts`, `app/api/push/subscribe/route.ts`, `app/api/cron/tick/route.ts`.
- **Pasos:**
  1. Pedido de permiso con explicación previa, desde un lugar con sentido (al crear la primera tarea de meal prep o en Perfil → Notificaciones). En iOS, explicar que hay que instalar la app primero.
  2. Envío con `web-push`; borrar suscripciones con 404/410.
  3. Recordatorios con `pg_cron` de Supabase (cada 15 min, extensión `pg_net`) que llama a `POST /api/cron/tick`, ruta protegida con el header `Authorization: Bearer $CRON_SECRET`: envía los `prep_tasks.remind_at` vencidos y avisos de descongelar ("Pasá el pescado a la heladera"). Documentar el alta del cron en `docs/deploy.md`.
  4. Preferencias por usuario: tipos de aviso on/off, horario silencioso.
  5. Timers de cocina con la app en segundo plano: programar el push al iniciar un timer pasivo de más de 5 min.
- **Aceptación:** con la app instalada y cerrada, llega el recordatorio en Android e iOS.

### T10.2 — Bandeja completa
- **Depende de:** T10.1, T4.4
- **Pasos:** nuevos tipos en `inbox_items`: `plan_approved` ("Sofi aprobó el plan de la semana"), `member_joined`, `list_done`. Push opcional para cada tipo. Marcar todo como leído.

### T10.3 — Offline
- **Depende de:** T8.5
- **Pasos:**
  1. Serwist runtime caching: páginas de recetas visitadas, la lista activa y el plan de la semana (stale-while-revalidate); imágenes con cache-first y límite.
  2. Lista de compras offline: los cambios de estado se guardan en una cola en IndexedDB (`idb-keyval`) y se sincronizan al volver la red; indicador "Sin conexión, se guarda cuando vuelva la señal".
  3. Modo cocinar 100% offline para recetas ya abiertas.
- **Aceptación:** en modo avión se puede tachar la lista y cocinar una receta; al volver la red, la pareja ve los cambios.

### T10.4 — Onboarding
- **Pasos:** primera vez después del login, 3 pantallas salteables: (1) "¿Con quién cocinás?" → crear grupo + invitar; (2) "Cargá 3 recetas que hacen siempre" → atajos a dictar/foto/escribir; (3) "Contanos cómo comen" → perfil alimentario. Checklist en "Hoy" hasta completarlo.
- **Aceptación:** una cuenta nueva llega a tener grupo, receta y perfil sin explicación externa.

### T10.5 — Accesibilidad y performance
- **Pasos:** Lighthouse mobile ≥ 90 en Performance, Accesibilidad y Best Practices en Hoy, Recetas y detalle; contraste AA en ambos temas; navegación por teclado y labels en formularios; `next/image` con tamaños correctos; revisar bundle (stories y dnd-kit cargados con `dynamic`).
- **Aceptación:** reporte de Lighthouse guardado en `docs/perf/`.

### T10.6 — Privacidad: exportar y borrar cuenta
- **Pasos:** en Perfil → "Mis datos": exportar todo (recetas propias, perfil, planes) en JSON; "Borrar mi cuenta" con confirmación escrita → borra perfil alimentario, inputs y archivos, sale de todos los grupos (transferencia de ownership), y elimina el usuario de Auth (service role). Las recetas de grupos compartidos quedan en el grupo.
- **Aceptación:** pgTAP/e2e: después de borrar, no queda nada del usuario salvo recetas en grupos compartidos.

---

## Cierre de la Etapa 10
- [ ] Revisión final 🧠 de seguridad y privacidad.
- [ ] Probar la app con otra familia o amigos.

## Notas de ejecución
