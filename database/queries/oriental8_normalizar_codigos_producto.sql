-- =============================================================================
-- Oriental 8 — Normalizar códigos en `productos.nombre` (sufijo " - N")
--
-- Regla: si el código al final del nombre es un solo dígito 1–9, pasa a 01–09
-- para que en el POS el filtro encuentre "01", "02", … igual que en la carta.
--
-- No modifica:
--   - dos o más dígitos (10, 11, 100, …)
--   - códigos tipo 901, 902, 903
--
-- Idempotente: volver a ejecutar no duplica ceros (" - 01" no matchea de nuevo).
--
-- Tenant: 565c0876-2235-4e7c-bb54-89c466fe4583
-- Ejecutar en Supabase SQL Editor (UPDATE en productos).
-- =============================================================================

BEGIN;

UPDATE productos
SET
  nombre = regexp_replace(nombre, ' - ([1-9])$', ' - 0\1'),
  updated_at = NOW()
WHERE tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid
  AND nombre ~ ' - [1-9]$';

-- Vista previa del resultado (opcional: comentar COMMIT y revisar antes de confirmar)
-- SELECT nombre FROM productos
-- WHERE tenant_id = '565c0876-2235-4e7c-bb54-89c466fe4583'
-- ORDER BY nombre;

COMMIT;
