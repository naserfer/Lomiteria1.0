-- =============================================================================
-- Oriental 8 — LIMPIEZA TRANSACCIONAL (datos de prueba operativos)
--
-- Tenant (verificá letra por letra antes de ejecutar):
--   565c0876-2235-4e7c-bb54-89c466fe4583
--
-- Incluye (borrado en orden FK-seguro):
--   Pedidos ítems y customización, facturas, divisiones, reprints, puntos por pedido,
--   movimientos inventario/materias vinculados al tenant,
--   eventos/log de mesas, trazas de impresión de esos pedidos, pedidos,
--   unions/reservas de mesas para el tenant, sesiones de caja del tenant.
--
-- Post-acción autorizada por negocio (Oriental 8):
--   - tenant_pedido_counters.ciclo_actual → 1 y ultimo_numero → 0
--   - tenant_facturacion.ultimo_numero → 0
--   - ingredientes.stock_actual → 0 (solo el stock numérico; NO se borran filas de materias primas)
--
-- NO borra: usuarios, clientes explícitos, categorías, productos, definición/recetas ni filas base
--   de ingredientes (solo las pone stock 0 como arriba).
--
-- Previo obligatorio:
--   1) Ejecutar oriental8_precheck_cleanup_transaccional.sql y registrar conteos esperados.
--   2) Backup / snapshot si tu política lo exige.
--
-- Ejecutación: seleccioná TODO el bloque BEGIN…COMMIT y corré una sola vez.
-- Si algo falla, Postgres aborta la transacción → ROLLBACK implícito.
-- =============================================================================

BEGIN;

-- ===========================================================================
-- Deletes (orden: hijos de pedidos / refs a pedidos → pedidos → mesas sesión → caja)
-- ===========================================================================

DELETE FROM public.items_pedido_customizacion c
WHERE c.item_pedido_id IN (
  SELECT i.id
  FROM public.items_pedido i
  JOIN public.pedidos p ON p.id = i.pedido_id
  WHERE p.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid
);

DELETE FROM public.items_pedido i
USING public.pedidos p
WHERE i.pedido_id = p.id
  AND p.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid;

DELETE FROM public.facturas f
WHERE f.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid;

DELETE FROM public.pedido_divisiones d
WHERE d.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid;

DELETE FROM public.reprint_solicitud r
WHERE r.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid;

DELETE FROM public.transacciones_puntos tp
WHERE tp.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid;

DELETE FROM public.movimientos_inventario mi
WHERE mi.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid;

DELETE FROM public.movimientos_ingredientes mg
WHERE mg.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid;

DELETE FROM public.mesa_eventos e
WHERE e.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid;

-- `order_id` es texto; debe coincidir con ids de pedidos del tenant antes de borrarlos.
DELETE FROM public.print_trace_events pte
WHERE pte.order_id IN (
  SELECT px.id::text
  FROM public.pedidos px
  WHERE px.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid
);

DELETE FROM public.pedidos p
WHERE p.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid;

DELETE FROM public.mesa_union_items m
WHERE m.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid;

DELETE FROM public.mesa_uniones u
WHERE u.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid;

DELETE FROM public.mesa_reservas r
WHERE r.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid;

DELETE FROM public.sesiones_caja s
WHERE s.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid;

-- ===========================================================================
-- Reseteos de negocio (Oriental 8 producción limpia)
-- ===========================================================================

UPDATE public.tenant_pedido_counters
SET ultimo_numero = 0,
    ciclo_actual = 1,
    updated_at = now()
WHERE tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid;

-- Si el tenant aún no tuviera fila (raro), la creamos.
INSERT INTO public.tenant_pedido_counters (tenant_id, ultimo_numero, ciclo_actual, updated_at)
SELECT '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid, 0, 1, now()
WHERE NOT EXISTS (
  SELECT 1
  FROM public.tenant_pedido_counters tpc
  WHERE tpc.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid
);

UPDATE public.tenant_facturacion
SET ultimo_numero = 0,
    updated_at = now()
WHERE tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid;

-- Si el UPDATE anterior no tocó ninguna fila (no existe `tenant_facturacion` para el tenant),
-- NO insertamos datos falsos desde SQL: configurá fiscalidad en Dashboard / script dedicado antes de producción.

-- Stock de materias primas a cero (no borra filas de `ingredientes`).
UPDATE public.ingredientes
SET stock_actual = 0,
    updated_at = now()
WHERE tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid;

-- ===========================================================================
-- Postcheck (misma transacción: validá resultados antes de COMMIT)
-- ===========================================================================

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
  SELECT 'POST_TX_items_pedido_customizacion' AS tabla,
         (SELECT count(*) FROM public.items_pedido_customizacion x WHERE x.item_pedido_id IN (SELECT id FROM tenant_items))::bigint AS filas
  UNION ALL
  SELECT 'POST_TX_items_pedido',
         (SELECT count(*) FROM public.items_pedido i WHERE i.pedido_id IN (SELECT id FROM tenant_orders))
  UNION ALL
  SELECT 'POST_TX_facturas',
         (SELECT count(*) FROM public.facturas f JOIN constants c ON f.tenant_id = c.tenant_id)
  UNION ALL
  SELECT 'POST_TX_pedido_divisiones',
         (SELECT count(*) FROM public.pedido_divisiones d JOIN constants c ON d.tenant_id = c.tenant_id)
  UNION ALL
  SELECT 'POST_TX_reprint_solicitud',
         (SELECT count(*) FROM public.reprint_solicitud r JOIN constants c ON r.tenant_id = c.tenant_id)
  UNION ALL
  SELECT 'POST_TX_transacciones_puntos',
         (SELECT count(*) FROM public.transacciones_puntos tp JOIN constants c ON tp.tenant_id = c.tenant_id)
  UNION ALL
  SELECT 'POST_TX_movimientos_inventario',
         (SELECT count(*) FROM public.movimientos_inventario mi JOIN constants c ON mi.tenant_id = c.tenant_id)
  UNION ALL
  SELECT 'POST_TX_movimientos_ingredientes',
         (SELECT count(*) FROM public.movimientos_ingredientes mg JOIN constants c ON mg.tenant_id = c.tenant_id)
  UNION ALL
  SELECT 'POST_TX_mesa_eventos',
         (SELECT count(*) FROM public.mesa_eventos e JOIN constants c ON e.tenant_id = c.tenant_id)
  UNION ALL
  SELECT 'POST_TX_print_trace_events',
         (SELECT count(*) FROM public.print_trace_events pte
          WHERE pte.order_id IN (SELECT id::text FROM tenant_orders))
  UNION ALL
  SELECT 'POST_TX_pedidos',
         (SELECT count(*) FROM public.pedidos p JOIN constants c ON p.tenant_id = c.tenant_id)
  UNION ALL
  SELECT 'POST_TX_mesa_union_items',
         (SELECT count(*) FROM public.mesa_union_items m JOIN constants c ON m.tenant_id = c.tenant_id)
  UNION ALL
  SELECT 'POST_TX_mesa_uniones',
         (SELECT count(*) FROM public.mesa_uniones u JOIN constants c ON u.tenant_id = c.tenant_id)
  UNION ALL
  SELECT 'POST_TX_mesa_reservas',
         (SELECT count(*) FROM public.mesa_reservas r JOIN constants c ON r.tenant_id = c.tenant_id)
  UNION ALL
  SELECT 'POST_TX_sesiones_caja',
         (SELECT count(*) FROM public.sesiones_caja s JOIN constants c ON s.tenant_id = c.tenant_id)
) q
ORDER BY tabla;

WITH constants AS (SELECT '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid AS tenant_id)
SELECT 'POST_counters_pedido' AS chequeo,
       tpc.ultimo_numero::bigint AS valor,
       concat('ciclo_actual=', tpc.ciclo_actual)::text AS detalle
FROM public.tenant_pedido_counters tpc
JOIN constants c ON tpc.tenant_id = c.tenant_id;

WITH constants AS (SELECT '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid AS tenant_id)
SELECT 'POST_facturacion_ultimo_numero' AS chequeo,
       tf.ultimo_numero::bigint AS valor,
       NULL::text AS detalle
FROM public.tenant_facturacion tf
JOIN constants c ON tf.tenant_id = c.tenant_id;

WITH constants AS (SELECT '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid AS tenant_id)
SELECT 'POST_ingredientes_stock_sum' AS chequeo,
       NULL::bigint AS valor,
       coalesce(round(sum(coalesce(i.stock_actual, 0)::numeric), 6)::text, '0') AS detalle
FROM public.ingredientes i
JOIN constants c ON i.tenant_id = c.tenant_id;

WITH constants AS (SELECT '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid AS tenant_id)
SELECT 'POST_catalogo_productos_filas' AS chequeo,
       count(*)::bigint AS valor,
       NULL::text AS detalle
FROM public.productos pr
JOIN constants c ON pr.tenant_id = c.tenant_id;

WITH constants AS (SELECT '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid AS tenant_id)
SELECT 'POST_catalogo_ingredientes_filas' AS chequeo,
       count(*)::bigint AS valor,
       NULL::text AS detalle
FROM public.ingredientes i
JOIN constants c ON i.tenant_id = c.tenant_id;

WITH constants AS (SELECT '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid AS tenant_id)
SELECT 'POST_usuarios_filas' AS chequeo,
       count(*)::bigint AS valor,
       NULL::text AS detalle
FROM public.usuarios u
JOIN constants c ON u.tenant_id = c.tenant_id;

COMMIT;
