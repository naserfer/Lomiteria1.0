-- =============================================================================
-- Tenant 26ab2897-c8d4-4768-be6e-7c1fee8500e9 — Alta / actualización de facturación
--
-- Propósito: que exista una fila en `tenant_facturacion` para este local (timbrado +
-- numeración 001-001-XXXXXXX). Sin eso, cerrar mesa/cuenta puede completarse pero no
-- emitir/imprimir factura (mensaje que viste).
--
-- Antes de ejecutar en Supabase SQL Editor:
--   1) Reemplazá el TIMBRADO por el número real de 8 dígitos DNIT (TEXT de longitud 8).
--   2) Ajustá vigencia_inicio / vigencia_fin según ese timbrado.
--   3) Si este local ya emitió facturas en papel con correlativo distinto, poné en
--      `ultimo_numero_insert` el último número de 7 dígitos ya usado (si es nuevo: 0).
--
-- Notas:
--   - `establecimiento` y `punto_expedicion` deben tener exactamente 3 caracteres.
--   - En conflicto (ya existe fila), este script ACTUALIZA timbrado/vigencias/puntos de
--     expedición pero NO modifica `ultimo_numero` existente (para no romper la serie).
-- =============================================================================

DO $$
DECLARE
  v_tenant_id uuid := '26ab2897-c8d4-4768-be6e-7c1fee8500e9'::uuid;

  -- ▼▼▼ EDITAR obligatorio antes de correr ▼▼▼
  v_timbrado text := '12345678';              -- 8 caracteres (ej. timbrado DNIT)
  v_vigencia_inicio date := '2026-01-01';
  v_vigencia_fin date := '2026-12-31';
  v_establecimiento text := '001';            -- 3 caracteres
  v_punto_expedicion text := '001';           -- 3 caracteres
  v_ultimo_numero_insert integer := 0;       -- solo se usa en INSERT inicial

  v_exists boolean;
BEGIN
  IF length(trim(v_timbrado)) <> 8 THEN
    RAISE EXCEPTION 'timbrado debe tener exactamente 8 caracteres (DNIT). Valor actual: %', v_timbrado;
  END IF;
  IF length(v_establecimiento) <> 3 OR length(v_punto_expedicion) <> 3 THEN
    RAISE EXCEPTION 'establecimiento y punto_expedicion deben tener 3 caracteres cada uno.';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = v_tenant_id)
  INTO v_exists;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'No existe public.tenants con id %', v_tenant_id;
  END IF;

  INSERT INTO public.tenant_facturacion (
    tenant_id,
    timbrado,
    vigencia_inicio,
    vigencia_fin,
    establecimiento,
    punto_expedicion,
    ultimo_numero,
    created_at,
    updated_at
  )
  VALUES (
    v_tenant_id,
    v_timbrado,
    v_vigencia_inicio,
    v_vigencia_fin,
    v_establecimiento,
    v_punto_expedicion,
    v_ultimo_numero_insert,
    now(),
    now()
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    timbrado = EXCLUDED.timbrado,
    vigencia_inicio = EXCLUDED.vigencia_inicio,
    vigencia_fin = EXCLUDED.vigencia_fin,
    establecimiento = EXCLUDED.establecimiento,
    punto_expedicion = EXCLUDED.punto_expedicion,
    updated_at = now();
    -- ultimo_numero: no se actualiza aquí (conserva la serie si ya había numeración).

  RAISE NOTICE 'OK: tenant_facturacion garantizada para tenant %', v_tenant_id;
END $$;

-- Verificación rápida
SELECT
  tf.tenant_id,
  tf.timbrado,
  tf.vigencia_inicio,
  tf.vigencia_fin,
  tf.establecimiento,
  tf.punto_expedicion,
  tf.ultimo_numero,
  t.nombre AS tenant_nombre,
  t.slug
FROM public.tenant_facturacion tf
JOIN public.tenants t ON t.id = tf.tenant_id
WHERE tf.tenant_id = '26ab2897-c8d4-4768-be6e-7c1fee8500e9'::uuid;

-- -----------------------------------------------------------------------------
-- Opcional: datos del emisor en la factura (vista_factura_impresion usa tenants.*).
-- Si RUC o razón social están vacíos, completarlos desde Admin o descomentá y editá:
-- -----------------------------------------------------------------------------
-- UPDATE public.tenants
-- SET
--   ruc = '80000001-1',
--   razon_social = 'RAZÓN SOCIAL / NOMBRE LEGAL DEL LOCAL',
--   direccion = 'Dirección fiscal del local',
--   telefono = '09xx xxx xxx',
--   email = 'facturacion@ejemplo.com',
--   actividad_economica = 'Restaurante / servicio de comidas',
--   updated_at = now()
-- WHERE id = '26ab2897-c8d4-4768-be6e-7c1fee8500e9'::uuid;
