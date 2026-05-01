-- =============================================================================
-- Oriental 8 — Eliminar duplicados en categoría SOPAS (soft delete)
--
-- Agrupa por el código final del menú (" - 06", " - 07", …). De cada grupo
-- deja un producto y marca is_deleted en el resto (histórico / pedidos
-- siguen apuntando al id que corresponda).
--
-- Criterio para elegir el que se conserva (rn = 1):
--   - "Sopa de maíz" antes que "Sopa de maiz"
--   - "Sopa de cha chay" antes que "Sopa cha chay"
--   - nombre más largo (más descriptivo)
--   - más antiguo (created_at), luego id estable
--
-- Tenant: 565c0876-2235-4e7c-bb54-89c466fe4583
-- Ejecutar después de oriental8_fix_categoria_sopas.sql si la verificación
-- muestra más de 6 filas o nombres repetidos.
-- =============================================================================

-- Vista previa: qué filas se marcarían como eliminadas (ejecutar solo esto primero si querés revisar)
WITH sopas_cat AS (
  SELECT id FROM categorias
  WHERE tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid AND nombre = 'SOPAS' LIMIT 1
),
ranked AS (
  SELECT
    p.id,
    p.nombre,
    substring(p.nombre from ' - ([0-9]+)$') AS codigo_menu,
    ROW_NUMBER() OVER (
      PARTITION BY substring(p.nombre from ' - ([0-9]+)$')
      ORDER BY
        (CASE WHEN p.nombre ILIKE '%maíz%' THEN 0 WHEN p.nombre ILIKE '%maiz%' THEN 1 ELSE 0 END),
        (CASE WHEN p.nombre ILIKE 'Sopa de cha chay%' THEN 0 WHEN p.nombre ILIKE 'Sopa cha chay%' THEN 1 ELSE 0 END),
        length(p.nombre) DESC,
        p.created_at ASC NULLS LAST,
        p.id
    ) AS rn
  FROM productos p
  CROSS JOIN sopas_cat sc
  WHERE p.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid
    AND p.categoria_id = sc.id
    AND COALESCE(p.is_deleted, false) = false
    AND substring(p.nombre from ' - ([0-9]+)$') IS NOT NULL
)
SELECT id, nombre, codigo_menu, rn FROM ranked WHERE rn > 1 ORDER BY codigo_menu;

BEGIN;

WITH sopas_cat AS (
  SELECT id FROM categorias
  WHERE tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid AND nombre = 'SOPAS' LIMIT 1
),
ranked AS (
  SELECT
    p.id,
    ROW_NUMBER() OVER (
      PARTITION BY substring(p.nombre from ' - ([0-9]+)$')
      ORDER BY
        (CASE WHEN p.nombre ILIKE '%maíz%' THEN 0 WHEN p.nombre ILIKE '%maiz%' THEN 1 ELSE 0 END),
        (CASE WHEN p.nombre ILIKE 'Sopa de cha chay%' THEN 0 WHEN p.nombre ILIKE 'Sopa cha chay%' THEN 1 ELSE 0 END),
        length(p.nombre) DESC,
        p.created_at ASC NULLS LAST,
        p.id
    ) AS rn
  FROM productos p
  CROSS JOIN sopas_cat sc
  WHERE p.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid
    AND p.categoria_id = sc.id
    AND COALESCE(p.is_deleted, false) = false
    AND substring(p.nombre from ' - ([0-9]+)$') IS NOT NULL
)
UPDATE productos p
SET
  is_deleted = true,
  deleted_at = NOW(),
  updated_at = NOW()
FROM ranked r
WHERE p.id = r.id
  AND r.rn > 1;

COMMIT;

-- Unificar ortografía del 06 si quedó la variante sin tilde (opcional, idempotente)
UPDATE productos
SET nombre = 'Sopa de maíz - 06', updated_at = NOW()
WHERE tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid
  AND nombre = 'Sopa de maiz - 06'
  AND COALESCE(is_deleted, false) = false;
