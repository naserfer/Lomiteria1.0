-- =============================================================================
-- Verificación post migración de numeración cíclica de pedidos
-- Ejecutar después de 31_pedidos_numero_ciclo.sql
-- =============================================================================

-- 1) Integridad: no debe haber duplicados por tenant+ciclo+número
SELECT
  tenant_id,
  pedido_ciclo,
  numero_pedido,
  COUNT(*) AS duplicados
FROM public.pedidos
GROUP BY tenant_id, pedido_ciclo, numero_pedido
HAVING COUNT(*) > 1
ORDER BY duplicados DESC;

-- 2) Health de counters: rango válido y consistencia básica
SELECT
  tpc.tenant_id,
  tpc.ciclo_actual,
  tpc.ultimo_numero,
  CASE
    WHEN tpc.ultimo_numero BETWEEN 0 AND 999 THEN 'ok'
    ELSE 'fuera_rango'
  END AS estado_rango
FROM public.tenant_pedido_counters tpc
ORDER BY tpc.updated_at DESC;

-- 3) Tenant sin fila en counter (debería ser 0 filas en producción sana)
SELECT t.id AS tenant_id, t.nombre
FROM public.tenants t
LEFT JOIN public.tenant_pedido_counters tpc ON tpc.tenant_id = t.id
WHERE tpc.tenant_id IS NULL
ORDER BY t.created_at DESC;

-- 4) Smoke test por tenant (opcional): últimos 15 pedidos con ciclo/número
-- Reemplazar UUID por tenant a revisar.
SELECT
  p.id,
  p.tenant_id,
  p.pedido_ciclo,
  p.numero_pedido,
  p.estado_pedido,
  p.created_at
FROM public.pedidos p
WHERE p.tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
ORDER BY p.created_at DESC
LIMIT 15;

-- 5) Distribución rápida de pedidos por ciclo (top 10 tenants con más pedidos)
WITH top_tenants AS (
  SELECT tenant_id
  FROM public.pedidos
  GROUP BY tenant_id
  ORDER BY COUNT(*) DESC
  LIMIT 10
)
SELECT
  p.tenant_id,
  p.pedido_ciclo,
  COUNT(*) AS pedidos_en_ciclo,
  MIN(p.numero_pedido) AS minimo_numero,
  MAX(p.numero_pedido) AS maximo_numero
FROM public.pedidos p
JOIN top_tenants tt ON tt.tenant_id = p.tenant_id
GROUP BY p.tenant_id, p.pedido_ciclo
ORDER BY p.tenant_id, p.pedido_ciclo DESC;
