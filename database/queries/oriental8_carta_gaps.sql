-- =============================================================================
-- Oriental 8 (tenant 565c0876-2235-4e7c-bb54-89c466fe4583)
-- Productos faltantes vs carta impresa / fotos (abr 2026)
--
-- Antes de ejecutar: revisar nombres y precios con el local.
-- Idempotente: no inserta si ya existe un producto activo con el mismo nombre.
-- Ejecutar en Supabase SQL Editor (rol con INSERT en productos).
--
-- Después de altas masivas, conviene ejecutar también:
--   database/queries/oriental8_normalizar_codigos_producto.sql
-- para dejar códigos 1–9 como 01–09 en el sufijo del nombre (búsqueda POS).
-- Si SOPAS mezcla fideos/mifen con sopas: oriental8_fix_categoria_sopas.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Sopas “clásicas” (carta págs. ENTRADA/SOPAS: ítems 06, 07, 09–12)
--     En la exportación CSV solo aparecían sopas tipo “fideo en sopa”, no estas.
-- -----------------------------------------------------------------------------

INSERT INTO productos (tenant_id, categoria_id, nombre, precio, disponible, is_deleted, tiene_receta, puntos_extra)
SELECT
  '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid,
  c.id,
  x.nombre,
  x.precio::numeric(10, 2),
  true,
  false,
  true,
  0
FROM categorias c
CROSS JOIN LATERAL (
  VALUES
    ('Sopa de maíz - 06', 33000),
    ('Sopa apimentada - 07', 35000),
    ('Sopa de algas c/huevo - 09', 33000),
    ('Sopa de verdura c/tofu - 10', 33000),
    ('Sopa cha chay - 11', 33000),
    ('Sopa de wanton - 12', 35000)
) AS x(nombre, precio)
WHERE c.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid
  AND c.nombre = 'SOPAS'
  AND NOT EXISTS (
    SELECT 1
    FROM productos p
    WHERE p.tenant_id = c.tenant_id
      AND lower(trim(p.nombre)) = lower(trim(x.nombre))
      AND COALESCE(p.is_deleted, false) = false
  );

-- -----------------------------------------------------------------------------
-- 2) Mifen en sopa (carta FIDEO DE ARROZ: 98, 99, 100)
-- -----------------------------------------------------------------------------

INSERT INTO productos (tenant_id, categoria_id, nombre, precio, disponible, is_deleted, tiene_receta, puntos_extra)
SELECT
  '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid,
  c.id,
  x.nombre,
  x.precio::numeric(10, 2),
  true,
  false,
  true,
  0
FROM categorias c
CROSS JOIN LATERAL (
  VALUES
    ('Mifen c/carne de cerdo en sopa - 98', 45000),
    ('Mifen c/carne vacuno en sopa - 99', 50000),
    ('Mifen c/cha chay en sopa - 100', 45000)
) AS x(nombre, precio)
WHERE c.tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid
  AND c.nombre = 'FIDEO DE ARROZ'
  AND NOT EXISTS (
    SELECT 1
    FROM productos p
    WHERE p.tenant_id = c.tenant_id
      AND lower(trim(p.nombre)) = lower(trim(x.nombre))
      AND COALESCE(p.is_deleted, false) = false
  );

-- -----------------------------------------------------------------------------
-- 3) Verificación rápida post-insert (opcional)
-- -----------------------------------------------------------------------------
SELECT nombre, precio FROM productos
WHERE tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'
  AND nombre ILIKE ANY (ARRAY['%Sopa de maíz%', '%Mifen c/carne de cerdo en sopa%'])
ORDER BY nombre;

-- -----------------------------------------------------------------------------
-- 4) Auditoría materias primas (opcional, plan paso 4)
-- -----------------------------------------------------------------------------
SELECT id, nombre, slug, unidad, activo, controlar_stock, stock_actual
FROM ingredientes
WHERE tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'
ORDER BY nombre;
