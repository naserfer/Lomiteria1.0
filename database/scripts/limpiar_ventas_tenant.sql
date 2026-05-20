-- ============================================
-- Script: Limpiar ventas y sesiones de caja de un tenant
-- Uso: simular "día nuevo" o pruebas con datos limpios
-- ============================================
-- IMPORTANTE: Ejecutar en Supabase SQL Editor.
-- Reemplazá el tenant_id abajo por el que quieras limpiar.
--
-- Qué hace:
--   - Borra todas las sesiones_caja del tenant
--   - Borra todos los pedidos del tenant (en cascada: items_pedido, facturas)
--   - Reinicia el contador de pedidos y el ciclo (próximo pedido será ciclo 1, #1)
--
-- Nota: Los puntos ya acreditados en clientes (puntos_totales) y las filas
-- en transacciones_puntos NO se revierten; quedan con pedido_id NULL.
-- Para una simulación limpia de ventas alcanza con esto.
-- ============================================

DO $$
DECLARE
  v_tenant_id UUID := '5a64ca76-b565-45e6-8c8c-c29f49c923c8';
  v_deleted_pedidos INT;
BEGIN
  -- 1. Eliminar sesiones de caja del tenant (aperturas/cierres)
  DELETE FROM sesiones_caja WHERE tenant_id = v_tenant_id;

  -- 2. Eliminar pedidos del tenant
  --    - items_pedido se borra en CASCADE
  --    - facturas se borra en CASCADE (facturas.pedido_id → pedidos.id ON DELETE CASCADE)
  --    - movimientos_inventario y transacciones_puntos tienen pedido_id ON DELETE SET NULL (quedan con pedido_id NULL)
  DELETE FROM pedidos WHERE tenant_id = v_tenant_id;
  GET DIAGNOSTICS v_deleted_pedidos = ROW_COUNT;

  -- 3. Reiniciar contador y ciclo para que el próximo sea ciclo 1, pedido #1
  UPDATE tenant_pedido_counters
  SET ultimo_numero = 0,
      ciclo_actual = 1,
      updated_at = NOW()
  WHERE tenant_id = v_tenant_id;

  RAISE NOTICE 'Listo. Tenant %: % pedidos eliminados; sesiones_caja eliminadas; contador reiniciado (ciclo=1, ultimo_numero=0).', v_tenant_id, v_deleted_pedidos;
END $$;

-- Opcional: verificar que no queden pedidos ni sesiones para ese tenant
-- SELECT 'pedidos' AS tabla, COUNT(*) AS filas FROM pedidos WHERE tenant_id = '5a64ca76-b565-45e6-8c8c-c29f49c923c8'
-- UNION ALL
-- SELECT 'sesiones_caja', COUNT(*) FROM sesiones_caja WHERE tenant_id = '5a64ca76-b565-45e6-8c8c-c29f49c923c8';
