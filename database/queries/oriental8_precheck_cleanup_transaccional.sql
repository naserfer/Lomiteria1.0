-- =============================================================================
-- Oriental 8 — PRECHECK (solo lectura) antes de limpieza transaccional
--
-- Tenant: 565c0876-2235-4e7c-bb54-89c466fe4583
--
-- Propósito: conteos esperados para que compares con oriental8_cleanup_transaccional.sql
--
-- Ejecutá este archivo primero en Supabase SQL Editor. No altera datos.
--
-- Conserva (explícito): usuarios (auth/tenant login), categorías, productos, recetas,
-- definición de ingredientes (filas en `ingredientes`). El cleanup solo pondrá stock en 0.
-- =============================================================================

WITH constants AS (
  SELECT '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid AS tenant_id
)
-- 0) Sanity: ¿existe el tenant?
SELECT '00_tenant' AS chequeo, NULL::bigint AS valor, t.id::text AS detalle_publico_safe
FROM public.tenants t
JOIN constants c ON t.id = c.tenant_id;

-- Importante en Postgres: cada sentencia debe traer su propio WITH; no se “hereda” al siguiente SELECT.
WITH constants AS (
  SELECT '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid AS tenant_id
)
SELECT '01_tenant_nombre' AS chequeo,
       NULL::bigint AS valor,
       t.nombre::text AS detalle_publico_safe
FROM public.tenants t
JOIN constants c ON t.id = c.tenant_id;

-- Inventario PRODUCTO (solo conteo para ver que no tocás filas aquí si no ejecutás otros scripts)
WITH constants AS (SELECT '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid AS tenant_id)
SELECT '02_productos_filas_catalogo' AS chequeo,
       count(*)::bigint AS valor,
       NULL::text AS detalle_publico_safe
FROM public.productos p
JOIN constants c ON p.tenant_id = c.tenant_id;

WITH constants AS (SELECT '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid AS tenant_id)
SELECT '03_categorias_filas_catalogo' AS chequeo,
       count(*)::bigint AS valor,
       NULL::text AS detalle_publico_safe
FROM public.categorias x
JOIN constants c ON x.tenant_id = c.tenant_id;

WITH constants AS (SELECT '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid AS tenant_id)
SELECT '04_usuarios_tenant_sin_borrar' AS chequeo,
       count(*)::bigint AS valor,
       NULL::text AS detalle_publico_safe
FROM public.usuarios u
JOIN constants c ON u.tenant_id = c.tenant_id;

WITH constants AS (SELECT '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid AS tenant_id)
SELECT '05_recetas_filas_sin_borrar' AS chequeo,
       count(*)::bigint AS valor,
       NULL::text AS detalle_publico_safe
FROM public.recetas_producto r
JOIN constants c ON r.tenant_id = c.tenant_id;

WITH constants AS (SELECT '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid AS tenant_id)
SELECT '06_ingredientes_filas_sin_borrar' AS chequeo,
       count(*)::bigint AS valor,
       NULL::text AS detalle_publico_safe
FROM public.ingredientes i
JOIN constants c ON i.tenant_id = c.tenant_id;

WITH constants AS (SELECT '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid AS tenant_id)
SELECT '07_ingredientes_stock_actual_sum' AS chequeo,
       NULL::bigint AS valor,
       coalesce(
         round(sum(coalesce(i.stock_actual, 0)::numeric), 6)::text,
         '0'
       ) AS detalle_publico_safe
FROM public.ingredientes i
JOIN constants c ON i.tenant_id = c.tenant_id;

-- Correlativos (se resetean a 0 en cleanup)
WITH constants AS (SELECT '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid AS tenant_id)
SELECT '08_tenant_pedido_counters' AS chequeo,
       tpc.ultimo_numero::bigint AS valor,
       NULL::text AS detalle_publico_safe
FROM public.tenant_pedido_counters tpc
JOIN constants c ON tpc.tenant_id = c.tenant_id;

WITH constants AS (SELECT '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid AS tenant_id)
SELECT '09_tenant_facturacion_ultimo_numero' AS chequeo,
       tf.ultimo_numero::bigint AS valor,
       tf.establecimiento || '-' || tf.punto_expedicion AS detalle_publico_safe
FROM public.tenant_facturacion tf
JOIN constants c ON tf.tenant_id = c.tenant_id;

-- Objetivos transaccionales (lo que debe quedar en 0 tras cleanup)
WITH constants AS (
  SELECT '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid AS tenant_id
),
tenant_orders AS (
  SELECT p.id FROM public.pedidos p JOIN constants c ON p.tenant_id = c.tenant_id
),
tenant_items AS (
  SELECT i.id FROM public.items_pedido i JOIN tenant_orders o ON i.pedido_id = o.id
)
SELECT * FROM (
  SELECT 'TX_items_pedido_customizacion' AS tabla,
         (SELECT count(*) FROM public.items_pedido_customizacion x WHERE x.item_pedido_id IN (SELECT id FROM tenant_items))::bigint AS filas
  UNION ALL
  SELECT 'TX_items_pedido',
         (SELECT count(*) FROM public.items_pedido i WHERE i.pedido_id IN (SELECT id FROM tenant_orders))
  UNION ALL
  SELECT 'TX_facturas',
         (SELECT count(*) FROM public.facturas f JOIN constants c ON f.tenant_id = c.tenant_id)
  UNION ALL
  SELECT 'TX_pedido_divisiones',
         (SELECT count(*) FROM public.pedido_divisiones d JOIN constants c ON d.tenant_id = c.tenant_id)
  UNION ALL
  SELECT 'TX_reprint_solicitud',
         (SELECT count(*) FROM public.reprint_solicitud r JOIN constants c ON r.tenant_id = c.tenant_id)
  UNION ALL
  SELECT 'TX_transacciones_puntos',
         (SELECT count(*) FROM public.transacciones_puntos tp JOIN constants c ON tp.tenant_id = c.tenant_id)
  UNION ALL
  SELECT 'TX_movimientos_inventario',
         (SELECT count(*) FROM public.movimientos_inventario mi JOIN constants c ON mi.tenant_id = c.tenant_id)
  UNION ALL
  SELECT 'TX_movimientos_ingredientes',
         (SELECT count(*) FROM public.movimientos_ingredientes mg JOIN constants c ON mg.tenant_id = c.tenant_id)
  UNION ALL
  SELECT 'TX_mesa_eventos',
         (SELECT count(*) FROM public.mesa_eventos e JOIN constants c ON e.tenant_id = c.tenant_id)
  UNION ALL
  SELECT 'TX_print_trace_events',
         (SELECT count(*) FROM public.print_trace_events pte
          WHERE pte.order_id IN (SELECT id::text FROM tenant_orders))
  UNION ALL
  SELECT 'TX_pedidos',
         (SELECT count(*) FROM public.pedidos p JOIN constants c ON p.tenant_id = c.tenant_id)
  UNION ALL
  SELECT 'TX_mesa_union_items',
         (SELECT count(*) FROM public.mesa_union_items m JOIN constants c ON m.tenant_id = c.tenant_id)
  UNION ALL
  SELECT 'TX_mesa_uniones',
         (SELECT count(*) FROM public.mesa_uniones u JOIN constants c ON u.tenant_id = c.tenant_id)
  UNION ALL
  SELECT 'TX_mesa_reservas',
         (SELECT count(*) FROM public.mesa_reservas r JOIN constants c ON r.tenant_id = c.tenant_id)
  UNION ALL
  SELECT 'TX_sesiones_caja',
         (SELECT count(*) FROM public.sesiones_caja s JOIN constants c ON s.tenant_id = c.tenant_id)
) t
ORDER BY tabla;
