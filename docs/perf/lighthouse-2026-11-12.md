# Lighthouse (mobile, build de producción local) — 12/11/2026

Medido con `lighthouse` (emulación mobile, throttling por defecto) contra `pnpm start`, con sesión iniciada.

| Pantalla | Performance | Accesibilidad | Best practices |
|---|---|---|---|
| Hoy | 94 | 100 | 100 |
| Recetas (lista) | 79–83 (ruidoso) | 100 | 100 |
| Detalle de receta | 95 | 100 | 100 |

## Cambios después de la primera medición

- Recetas: la primera página ahora se resuelve en el servidor (antes se pedía con una server action después de montar). Eso eliminó el error de consola ("An unexpected response was received from the server") y llevó Best practices a 100.
- Se sacó del service worker el caché de datos RSC (se cacheaban por URL sin mirar los headers, lo que puede servir una respuesta equivocada). Quedan páginas (network-first), fotos (cache-first) y los defaults de Serwist.
- Los títulos de las tarjetas de receta pasaron a `h2` (orden de encabezados).

## Pendiente

- Performance de Recetas queda entre 79 y 83 por TBT (≈ 0,9 s): el chunk base de Next/React (~812 KB, ~264 KiB gzip) pesa ~1,5 s de CPU con el throttling de Lighthouse. No es código propio; se puede revisar si hace falta con un analizador de bundle.
- Medir también en un dispositivo real: Lighthouse local no refleja la red de producción.

## Accesibilidad

`tests/e2e/a11y.spec.ts` corre axe (WCAG 2.1 A/AA) sobre Hoy, Recetas, detalle, Plan, Compras y Perfil en los tres temas (mediodía, tarde, noche): 0 violaciones.
