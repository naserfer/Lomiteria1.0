-- Reparación operativa de cierre de cuenta con mesa:
-- 1) garantiza tenant_facturacion del tenant correcto
-- 2) emite factura faltante si no existe
-- 3) incrementa numeración fiscal
-- 4) encola impresión en reprint_solicitud (tipo factura)
--
-- Uso:
-- - reemplazá los valores de v_pedido_id y v_tenant_id
-- - ejecutá el bloque completo en Supabase SQL Editor

DO $$
DECLARE
  v_pedido_id uuid := 'aa1306fb-3ca2-4bc7-82a2-b5f934dc988a'::uuid;
  v_tenant_id uuid := '565c0876-2235-4e7c-bb54-89c466fe4583'::uuid;

  v_cfg record;
  v_pedido record;
  v_siguiente integer;
  v_numero_factura text;
  v_total_iva_10 numeric(12,2);
  v_total_exento numeric(12,2);
BEGIN
  SELECT id, tenant_id, cliente_id, total, estado_pedido
  INTO v_pedido
  FROM public.pedidos
  WHERE id = v_pedido_id
    AND tenant_id = v_tenant_id
  LIMIT 1;

  IF v_pedido.id IS NULL THEN
    RAISE EXCEPTION 'Pedido % no existe para tenant %', v_pedido_id, v_tenant_id;
  END IF;

  IF v_pedido.estado_pedido <> 'FACT' THEN
    RAISE EXCEPTION 'Pedido % no está en estado FACT', v_pedido_id;
  END IF;

  INSERT INTO public.tenant_facturacion (
    tenant_id,
    timbrado,
    vigencia_inicio,
    vigencia_fin,
    establecimiento,
    punto_expedicion,
    ultimo_numero
  )
  VALUES (
    v_tenant_id,
    '99999999',
    current_date,
    (current_date + interval '365 days')::date,
    '001',
    '001',
    0
  )
  ON CONFLICT (tenant_id) DO NOTHING;

  SELECT tenant_id, timbrado, establecimiento, punto_expedicion, ultimo_numero
  INTO v_cfg
  FROM public.tenant_facturacion
  WHERE tenant_id = v_tenant_id
  LIMIT 1;

  IF v_cfg.tenant_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo obtener tenant_facturacion para %', v_tenant_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.facturas f
    WHERE f.pedido_id = v_pedido_id
      AND f.tenant_id = v_tenant_id
      AND COALESCE(f.anulada, false) = false
  ) THEN
    v_siguiente := COALESCE(v_cfg.ultimo_numero, 0) + 1;
    v_numero_factura := v_cfg.establecimiento || '-' || v_cfg.punto_expedicion || '-' || lpad(v_siguiente::text, 7, '0');
    v_total_iva_10 := ROUND(((COALESCE(v_pedido.total, 0)::numeric / 1.1) * 0.1)::numeric, 2);
    v_total_exento := ROUND((COALESCE(v_pedido.total, 0)::numeric - v_total_iva_10)::numeric, 2);

    INSERT INTO public.facturas (
      tenant_id,
      pedido_id,
      numero_factura,
      timbrado,
      cliente_id,
      total,
      total_iva_10,
      total_iva_5,
      total_exento
    )
    VALUES (
      v_tenant_id,
      v_pedido_id,
      v_numero_factura,
      v_cfg.timbrado,
      v_pedido.cliente_id,
      COALESCE(v_pedido.total, 0),
      v_total_iva_10,
      0,
      v_total_exento
    );

    UPDATE public.tenant_facturacion
    SET ultimo_numero = v_siguiente,
        updated_at = now()
    WHERE tenant_id = v_tenant_id;
  END IF;

  INSERT INTO public.reprint_solicitud (tenant_id, pedido_id, tipo)
  VALUES (v_tenant_id, v_pedido_id, 'factura');

  RAISE NOTICE 'OK: reparación aplicada para pedido %, tenant %', v_pedido_id, v_tenant_id;
END $$;
