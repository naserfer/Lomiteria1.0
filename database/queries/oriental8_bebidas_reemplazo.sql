-- =============================================================================
-- Oriental 8 — Reemplazo de carta de BEBIDAS (sin código numérico en el nombre)
--
-- 1) Archiva productos vigentes actualmente en la categoría BEBIDAS (soft delete).
-- 2) Inserta el listado nuevo con precios solicitados por el cliente.
--
-- Marcas ajustadas: Miller / Heineken desde el texto enviado. En Paraguay «raya»
-- en carteles de bar suele referir servicio tipo chupito / medida; se deja visible
-- en el nombre del whisky. «Soyu» según nomenclatura del local.
--
-- Ejecutar en Supabase SQL Editor. Revisá marcas antes de producción si hace falta.
--
-- ⚠ Ejecutá este script solo UNA VEZ por tenant: cada corrida marca como borrados
--    todos los productos vigentes en BEBIDAS y vuelve a insertar el catálogo.
--    Si necesitás re-ejecutar, primero revisá huérfanos en `productos.is_deleted`.
--
-- Tenant: 565c0876-2235-4e7c-bb54-89c466fe4583
-- =============================================================================

BEGIN;

WITH tenant AS (
  SELECT '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid AS tid
),
bebidas_cat AS (
  SELECT c.id
  FROM categorias c
  CROSS JOIN tenant t
  WHERE c.tenant_id = t.tid
    AND (
      trim(upper(c.nombre)) = 'BEBIDAS'
      OR trim(upper(c.nombre)) LIKE '%BEBIDA%'
    )
  ORDER BY CASE WHEN trim(upper(c.nombre)) = 'BEBIDAS' THEN 0 ELSE 1 END
  LIMIT 1
),
archivo AS (
  UPDATE productos p
  SET
    is_deleted = true,
    deleted_at = NOW(),
    updated_at = NOW()
  FROM bebidas_cat bc
  CROSS JOIN tenant t
  WHERE p.tenant_id = t.tid
    AND p.categoria_id = bc.id
    AND COALESCE(p.is_deleted, false) = false
  RETURNING p.id
)
INSERT INTO productos (
  tenant_id,
  categoria_id,
  nombre,
  precio,
  disponible,
  is_deleted,
  tiene_receta,
  puntos_extra,
  updated_at
)
SELECT
  t.tid,
  bc.id,
  x.nombre,
  x.precio::numeric(10, 2),
  true,
  false,
  false,
  0,
  NOW()
FROM bebidas_cat bc
CROSS JOIN tenant t
CROSS JOIN LATERAL (
  VALUES
    -- Aguas / refrescos / té
    ('Agua sin gas', 8000),
    ('Agua con gas', 8000),
    ('Tónica 500 ml', 10000),
    ('Gaseosa 350 ml', 8000),
    ('Gaseosa 500 ml', 10000),
    ('Gaseosa 1 L', 15000),
    ('Té frío 500 ml', 10000),
    ('Té frío (jarra)', 15000),
    ('Té caliente', 10000),
    -- Cervezas
    ('Cerveza Corona', 22000),
    ('Cerveza Pilsen', 15000),
    ('Cerveza Miller', 20000),
    ('Cerveza Heineken', 22000),
    -- Vinos
    ('Vino Santa Helena — Botella', 38000),
    ('Vino Santa Helena — Chico', 28000),
    ('Vino Santa Carolina — Botella', 45000),
    ('Vino Santa Carolina — Chico', 30000),
    ('Vino Quinta Morgado', 32000),
    -- Whisky (raya = chupito / medida, jerga local)
    ('Whisky Chivas Regal — raya', 22000),
    ('Whisky Johnnie Walker Negro — raya', 25000),
    ('Whisky Soyu', 20000)
) AS x(nombre, precio)
WHERE bc.id IS NOT NULL;

COMMIT;

-- Verificación sugerida
SELECT nombre, precio FROM productos p
JOIN categorias c ON c.id = p.categoria_id AND c.tenant_id = p.tenant_id
WHERE p.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'
  AND trim(upper(c.nombre)) = 'BEBIDAS'
  AND COALESCE(p.is_deleted,false) = false
ORDER BY nombre;
