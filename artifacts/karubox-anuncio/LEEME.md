# Capturas de KarúBox para anuncios

Todas las capturas usan el modo oscuro y las pantallas originales del proyecto. Los nombres, pedidos, ventas y clientes son ficticios. El local aparece como **Karú Burger · Demo**.

## Archivos

- `01-pos-pedido-oscuro.png`: catálogo y pedido de seis unidades, cliente, puntos y total de Gs 147.000.
- `02-pos-personalizacion-oscuro.png`: editor de ingredientes, extra de cheddar y sin cebolla.
- `03-admin-resumen-oscuro.png`: administración y resumen de los últimos siete días.
- `04-admin-completo-oscuro.png`: página completa de administración.
- `05-admin-analisis-oscuro.png`: canales de venta, clientes, productos estrella y consumo.
- `06-pos-combos-oscuro.png`: catálogo de combos con el pedido armado.
- `07-historial-pedidos-oscuro.png`: pedidos de muestra por cliente y canal.
- `08-admin-kpis-grafico-oscuro.png`: KPIs y gráfico de ventas; recomendado junto con la captura 01 para el anuncio.

Las vistas de pantalla se exportaron en PNG a **3200 × 2400 px**. La página completa y el detalle de análisis tienen altura propia. Son capturas directas del navegador; no se retocaron cifras ni componentes.

## Datos de muestra

- 20 productos, incluidos tres combos y dos salsas.
- 593 pedidos distribuidos en siete días.
- 248 clientes ficticios.
- 24 insumos, dos con alerta de stock.
- Ventas del período: **Gs 40.574.000**.
- Costo estimado por la aplicación (48%): **Gs 19.475.520**.
- Ganancia estimada: **Gs 21.098.480**.

## Volver a abrir la demo

Desde la raíz del proyecto, con las dependencias instaladas:

```sh
node scripts/demo-anuncio/start.cjs
```

Abrir http://127.0.0.1:3000/login.

- Correo de demostración: `demo@example.com`
- Contraseña de demostración: `KaruboxDemo2026!`
- Para activar modo oscuro: menú superior del usuario → Modo oscuro.
- POS: `/home/pos`
- Administración: `/home/admin`; elegir `7 días` para las cifras de estas capturas.

La API de fixtures escucha en `127.0.0.1:54321`; Next.js en `127.0.0.1:3000`. Ambos puertos deben estar libres al reiniciar. Ctrl+C detiene el lanzador y sus procesos.

Los datos viven en memoria. Las escrituras están deshabilitadas: se puede armar y personalizar el carrito, pero confirmar pedidos o modificar la base no forma parte de esta demo de capturas. La autenticación es simulada; **no se validó el Auth real de Supabase**. No se necesitan credenciales reales ni se modifica una base de producción.

## Regenerar las capturas

Con la demo ejecutándose:

```sh
node scripts/demo-anuncio/capture.cjs
```

El script usa Playwright del runtime de Codex y una instancia aislada de Chrome. En otro equipo se pueden indicar las rutas con `PLAYWRIGHT_PATH` y `CHROME_PATH`. Guarda la sesión ficticia temporalmente en `/private/tmp/karubox-demo-session.json`. Los únicos estilos ocultados son los indicadores de desarrollo de Next.js.

`verificacion.json` registra la resolución, la fecha de exportación y los errores JavaScript detectados. La preparación agrega únicamente los scripts de demo y estos artefactos; no modifica los componentes originales de la aplicación.
