-- =============================================================================
-- Oriental 8 — Validar duplicados en productos (solo lectura)
--
-- Ejecutá cada SELECT en Supabase SQL Editor. Si alguna consulta devuelve filas,
-- hay algo a revisar (dedupe manual, soft delete duplicados o unificar nombre).
--
-- Tenant: 565c0876-2235-4e7c-bb54-89c466fe4583
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Mismo nombre EXACTO, productos activos (el más habitual)
--     Ideal: 0 filas.
-- -----------------------------------------------------------------------------
SELECT
  nombre,
  COUNT(*) AS cantidad,
  array_agg(id ORDER BY created_at NULLS LAST, id) AS ids
FROM productos
WHERE tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid
  AND COALESCE(is_deleted, false) = false
GROUP BY nombre
HAVING COUNT(*) > 1
ORDER BY cantidad DESC, nombre;

-- -----------------------------------------------------------------------------
-- 2) Mismo nombre ignorando mayúsculas (typos por casing)
-- -----------------------------------------------------------------------------
SELECT
  lower(trim(nombre)) AS nombre_normalizado,
  COUNT(*) AS cantidad,
  array_agg(nombre ORDER BY nombre) AS variantes_nombre,
  array_agg(id ORDER BY created_at NULLS LAST, id) AS ids
FROM productos
WHERE tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid
  AND COALESCE(is_deleted, false) = false
GROUP BY lower(trim(nombre))
HAVING COUNT(*) > 1
ORDER BY cantidad DESC;

-- -----------------------------------------------------------------------------
-- 3) Mismo código de menú (sufijo " - NN") dentro de una MISMA categoría
--     Ej.: dos filas "- 07" en SOPAS. Ideal: 0 filas.
-- -----------------------------------------------------------------------------
SELECT
  cat.nombre AS categoria,
  substring(p.nombre from ' - ([0-9]+)$') AS codigo_menu,
  COUNT(*) AS cantidad,
  array_agg(p.nombre ORDER BY p.nombre) AS nombres,
  array_agg(p.id ORDER BY p.created_at NULLS LAST, p.id) AS ids
FROM productos p
JOIN categorias cat
  ON cat.id = p.categoria_id AND cat.tenant_id = p.tenant_id
WHERE p.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid
  AND COALESCE(p.is_deleted, false) = false
  AND substring(p.nombre from ' - ([0-9]+)$') IS NOT NULL
GROUP BY cat.id, cat.nombre, substring(p.nombre from ' - ([0-9]+)$')
HAVING COUNT(*) > 1
ORDER BY cat.nombre, codigo_menu::int NULLS LAST;

-- -----------------------------------------------------------------------------
-- 4) Opcional — mismo código en TODO el tenant (entre categorías)
--     Suele indicar ítem cargado dos veces con rubros distintos.
-- -----------------------------------------------------------------------------
SELECT
  substring(p.nombre from ' - ([0-9]+)$') AS codigo_menu,
  COUNT(*) AS cantidad,
  array_agg(cat.nombre ORDER BY cat.nombre) AS categorias,
  array_agg(p.nombre ORDER BY p.nombre) AS nombres,
  array_agg(p.id ORDER BY p.created_at NULLS LAST, p.id) AS ids
FROM productos p
JOIN categorias cat
  ON cat.id = p.categoria_id AND cat.tenant_id = p.tenant_id
WHERE p.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid
  AND COALESCE(p.is_deleted, false) = false
  AND substring(p.nombre from ' - ([0-9]+)$') IS NOT NULL
GROUP BY substring(p.nombre from ' - ([0-9]+)$')
HAVING COUNT(*) > 1
ORDER BY codigo_menu::int NULLS LAST;

-- -----------------------------------------------------------------------------
-- 5) Opcional — duplicados entre activos Y borrados lógicos (mismo nombre)
--     Útil para limpieza histórica; no siempre es error.
-- -----------------------------------------------------------------------------
SELECT
  nombre,
  COUNT(*) FILTER (WHERE COALESCE(is_deleted, false) = false) AS activos,
  COUNT(*) FILTER (WHERE COALESCE(is_deleted, false)) AS borrados_logico,
  COUNT(*) AS total
FROM productos
WHERE tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid
GROUP BY nombre
HAVING COUNT(*) > 1
ORDER BY activos DESC, total DESC, nombre;
