-- =============================================================================
-- Oriental 8 — Asignar productos a categoría CHOPSUEY / VERDURA / TOFU
--
-- Carta 13–26 y 85. Detecta código:
--   A) Tras guión final (ASCII o unicode ‐ – — −), con espacios opcionales
--   B) Último número al final del nombre sin formar parte de un número más largo
--      (evita “…317” contando como “17”)
--
-- Prefijos: Chopsuey, Chop suey, Verdura(s) chino, Brote de soja, Berenjena, Tofu
--
-- Tenant: 565c0876-2235-4e7c-bb54-89c466fe4583
-- =============================================================================

BEGIN;

WITH chops_cat AS (
  SELECT id
  FROM categorias
  WHERE tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid
    AND (
      trim(nombre) = 'CHOPSUEY / VERDURA / TOFU'
      OR upper(replace(replace(trim(nombre), ' ', ''), '/', '')) = 'CHOPSUEYVERDURATOFU'
      OR (
        upper(trim(nombre)) LIKE '%CHOPSUEY%'
        AND upper(trim(nombre)) LIKE '%VERDURA%'
        AND upper(trim(nombre)) LIKE '%TOFU%'
      )
    )
  ORDER BY
    CASE WHEN trim(nombre) = 'CHOPSUEY / VERDURA / TOFU' THEN 0 ELSE 1 END,
    length(trim(nombre))
  LIMIT 1
),
markers AS (
  SELECT
    p.id AS pid,
    replace(
      replace(
        replace(
          replace(replace(trim(p.nombre), CHR(8722), '-'), CHR(8212), '-'),
          CHR(8211),
          '-'
        ),
        CHR(8209),
        '-'
      ),
      CHR(8208),
      '-'
    ) AS norm
  FROM productos p
  WHERE p.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid
    AND COALESCE(p.is_deleted, false) = false
)
UPDATE productos p
SET
  categoria_id = c.id,
  updated_at = NOW()
FROM chops_cat c,
  markers m
WHERE p.id = m.pid
  AND p.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid
  AND c.id IS NOT NULL
  AND p.categoria_id IS DISTINCT FROM c.id
  AND (
    p.nombre ILIKE 'Chopsuey%'
    OR p.nombre ILIKE 'Chop suey%'
    OR p.nombre ILIKE 'Verdura chino%'
    OR p.nombre ILIKE 'Verduras chino%'
    OR p.nombre ILIKE 'Brote de soja%'
    OR p.nombre ILIKE 'Berenjena%'
    OR p.nombre ILIKE 'Tofu%'
    OR trim(substring(m.norm FROM ' -[[:space:]]*([0-9]+)[[:space:]]*$')) IN (
      '13', '14', '15', '16', '17', '18', '19',
      '20', '21', '22', '23', '24', '25', '26',
      '85'
    )
    OR m.norm ~ '(^|[^0-9])(13|14|15|16|17|18|19|20|21|22|23|24|25|26|85)[[:space:]]*$'
  );

COMMIT;

-- -----------------------------------------------------------------------------
-- Verificación
-- -----------------------------------------------------------------------------
-- SELECT p.nombre, p.precio, cat.nombre AS categoria
-- FROM productos p
-- JOIN categorias cat ON cat.id = p.categoria_id AND cat.tenant_id = p.tenant_id
-- WHERE p.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'
--   AND cat.nombre ILIKE '%CHOPSUEY%'
--   AND COALESCE(p.is_deleted, false) = false
-- ORDER BY (substring(p.nombre FROM '([0-9]+)[[:space:]]*$'))::int NULLS LAST, p.nombre;
