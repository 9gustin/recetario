# Lighthouse (mobile, build de producción local) — 12/11/2026

Medido con `lighthouse` (emulación mobile, throttling por defecto) contra `pnpm start`, con sesión iniciada.

| Pantalla | Performance | Accesibilidad | Best practices |
|---|---|---|---|
| Hoy | 94 | 100 | 100 |
| Recetas (lista) | 83 | 100 | 96 |
| Detalle de receta | 95 | 100 | 100 |

## Pendiente (Recetas)

- Performance 83: TBT ≈ 510 ms. El chunk compartido más grande (~264 KiB) tarda ~1,1 s de CPU con el throttling de Lighthouse. Candidatos: separar lo que no se usa en la lista (filtros, "Apta para…") con `dynamic()` y revisar `@supabase/supabase-js` en el bundle del cliente.
- Best practices 96: hay un error en consola ("An unexpected response was received from the server") en la carga de la lista; se reproduce solo bajo Lighthouse (con cookies inyectadas). Conviene revisarlo en un celular real.
- Medir también en un dispositivo real: Lighthouse local no refleja la red de producción.

## Accesibilidad

`tests/e2e/a11y.spec.ts` corre axe (WCAG 2.1 A/AA) sobre Hoy, Recetas, detalle, Plan, Compras y Perfil en los tres temas (mediodía, tarde, noche): 0 violaciones.
