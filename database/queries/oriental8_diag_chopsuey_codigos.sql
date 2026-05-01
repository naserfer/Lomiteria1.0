-- =============================================================================
-- Oriental 8 — Diagnóstico: productos activos de la hoja CHOPSUEY (códigos finales
-- 13–26 y 85). Si alguno no aparece aquí pero existe en BD, el nombre no termina en
-- ese código (ej. texto extra después del número).
-- Solo lectura.
--
-- Tenant: 565c0876-2235-4e7c-bb54-89c466fe4583
-- =============================================================================

WITH prod AS (
  SELECT
    p.id,
    p.nombre,
    cat.nombre AS categoria_actual,
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
  JOIN categorias cat ON cat.id = p.categoria_id AND cat.tenant_id = p.tenant_id
  WHERE p.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid
    AND COALESCE(p.is_deleted, false) = false
)
SELECT
  nombre,
  norm,
  trim(substring(norm FROM ' -[[:space:]]*([0-9]+)[[:space:]]*$')) AS codigo_tras_raya,
  categoria_actual
FROM prod
WHERE norm ~ '(^|[^0-9])(13|14|15|16|17|18|19|20|21|22|23|24|25|26|85)[[:space:]]*$'
ORDER BY nombre;
