-- =============================================================================
-- Oriental 8 — Corregir categoría SOPAS vs FIDEOS / FIDEO DE ARROZ
--
-- Problema: en BD aparecían en "SOPAS" platos que en la carta están en otra sección
-- (fideos en sopa → FIDEOS; mifen en sopa → FIDEO DE ARROZ). La hoja "SOPAS 湯類"
-- solo lista las 6 sopas: 06, 07, 09, 10, 11, 12.
--
-- Tenant: 565c0876-2235-4e7c-bb54-89c466fe4583
-- Ejecutar en Supabase SQL Editor.
-- =============================================================================

BEGIN;

WITH cats AS (
  SELECT
    (SELECT id FROM categorias WHERE tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid AND nombre = 'SOPAS' LIMIT 1)       AS sopas_id,
    (SELECT id FROM categorias WHERE tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid AND nombre = 'FIDEOS' LIMIT 1)       AS fideos_id,
    (SELECT id FROM categorias WHERE tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid AND nombre = 'FIDEO DE ARROZ' LIMIT 1) AS mifen_id
)
-- 1) Sacar de SOPAS → FIDEOS todo "Fideo … en sopa" (carta 麵類 / fideos)
UPDATE productos p
SET
  categoria_id = c.fideos_id,
  updated_at = NOW()
FROM cats c
WHERE p.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid
  AND c.sopas_id IS NOT NULL
  AND c.fideos_id IS NOT NULL
  AND p.categoria_id = c.sopas_id
  AND p.nombre ILIKE 'Fideo%en sopa%';

WITH cats AS (
  SELECT
    (SELECT id FROM categorias WHERE tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid AND nombre = 'SOPAS' LIMIT 1)       AS sopas_id,
    (SELECT id FROM categorias WHERE tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid AND nombre = 'FIDEO DE ARROZ' LIMIT 1) AS mifen_id
)
-- 2) Sacar de SOPAS → FIDEO DE ARROZ los mifen en sopa (carta 米粉)
UPDATE productos p
SET
  categoria_id = c.mifen_id,
  updated_at = NOW()
FROM cats c
WHERE p.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid
  AND c.sopas_id IS NOT NULL
  AND c.mifen_id IS NOT NULL
  AND p.categoria_id = c.sopas_id
  AND p.nombre ILIKE 'Mifen%en sopa%';

WITH cats AS (
  SELECT
    (SELECT id FROM categorias WHERE tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid AND nombre = 'SOPAS' LIMIT 1) AS sopas_id
)
-- 3) Las 6 sopas de la carta impresa → siempre categoría SOPAS
UPDATE productos p
SET
  categoria_id = c.sopas_id,
  updated_at = NOW()
FROM cats c
WHERE p.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid
  AND c.sopas_id IS NOT NULL
  AND p.categoria_id IS DISTINCT FROM c.sopas_id
  AND p.nombre NOT ILIKE 'Fideo%'
  AND p.nombre NOT ILIKE 'Mifen%'
  AND (
    p.nombre ILIKE 'Sopa de maíz%'
    OR p.nombre ILIKE 'Sopa de maiz%'
    OR p.nombre ILIKE 'Sopa apimentada%'
    OR p.nombre ILIKE 'Sopa de algas%'
    OR p.nombre ILIKE 'Sopa de verdura%'
    OR p.nombre ILIKE 'Sopa de cha chay%'
    OR p.nombre ILIKE 'Sopa cha chay%'
    OR p.nombre ILIKE 'Sopa de wanton%'
  );

COMMIT;

-- -----------------------------------------------------------------------------
-- Verificación (ejecutar aparte)
-- -----------------------------------------------------------------------------
-- Solo productos activos en SOPAS (deberían ser exactamente 6 filas).
-- Si hay duplicados (mismo código o maíz/maiz), ejecutar:
--   database/queries/oriental8_dedupe_productos_sopas.sql
SELECT p.nombre, p.precio, cat.nombre AS categoria
FROM productos p
JOIN categorias cat ON cat.id = p.categoria_id AND cat.tenant_id = p.tenant_id
WHERE p.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'
  AND cat.nombre = 'SOPAS'
  AND COALESCE(p.is_deleted, false) = false
ORDER BY p.nombre;
