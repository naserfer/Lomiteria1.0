-- ============================================
-- Factura: usar nombre comercial del local en cabecera
-- ============================================
-- Objetivo:
-- - Evitar que la cabecera muestre razón social del dueño
-- - Mostrar siempre el nombre del local (tenants.nombre)
--
-- Este script actualiza la vista consumida por el agente de impresión.

CREATE OR REPLACE VIEW public.vista_factura_impresion AS
SELECT
  f.id AS factura_id,
  f.pedido_id,
  f.tenant_id,
  p.numero_pedido,

  t.ruc AS emisor_ruc,
  t.nombre AS emisor_razon_social,
  t.direccion AS emisor_direccion,
  t.telefono AS emisor_telefono,
  t.email AS emisor_email,
  t.actividad_economica AS emisor_actividad_economica,

  COALESCE(f.receptor_ruc_impresion, c.ruc) AS receptor_ruc,
  COALESCE(f.receptor_ci_impresion, c.ci) AS receptor_ci,
  COALESCE(f.receptor_nombre_impresion, c.nombre) AS receptor_nombre,
  c.direccion AS receptor_direccion,
  c.telefono AS receptor_telefono,
  c.email AS receptor_email,

  f.numero_factura,
  f.timbrado,
  tf.vigencia_inicio AS timbrado_vigencia_inicio,
  tf.vigencia_fin AS timbrado_vigencia_fin,
  f.fecha_emision,

  f.total_iva_10,
  f.total_iva_5,
  f.total_exento,
  f.total AS total_a_pagar,
  f.total_letras,

  (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          -- En factura ocultamos sufijos de código de carta (ej: " - 71")
          -- sin afectar el nombre usado en cocina/POS.
          'producto_nombre',
            regexp_replace(ip.producto_nombre, '\s-\s[0-9]+$', '')
            || COALESCE(
              (
                SELECT
                  CASE
                    WHEN COUNT(*) = 0 THEN ''
                    ELSE ' (Extra: ' || string_agg(i.nombre, ', ' ORDER BY i.nombre) || ')'
                  END
                FROM public.items_pedido_customizacion c
                JOIN public.ingredientes i ON i.id = c.ingrediente_id
                WHERE c.item_pedido_id = ip.id
                  AND c.tipo = 'extra'
              ),
              ''
            ),
          'cantidad', ip.cantidad,
          'precio_unitario', ip.precio_unitario,
          'subtotal', ip.subtotal,
          'iva_porcentaje', ip.iva_porcentaje,
          'monto_iva', ip.monto_iva
        )
        ORDER BY ip.created_at
      ),
      '[]'::jsonb
    )
    FROM public.items_pedido ip
    WHERE ip.pedido_id = f.pedido_id
  ) AS detalle,
  m.numero AS mesa_numero,
  COALESCE(t.config_impresion ->> 'pie_ticket', '¡Gracias por tu compra!') AS saludo_final

FROM public.facturas f
JOIN public.tenants t ON t.id = f.tenant_id AND t.is_deleted = false
JOIN public.pedidos p ON p.id = f.pedido_id
LEFT JOIN public.mesas m ON m.id = p.mesa_id AND m.tenant_id = p.tenant_id
LEFT JOIN public.clientes c ON c.id = f.cliente_id AND (c.is_deleted = false OR c.is_deleted IS NULL)
LEFT JOIN public.tenant_facturacion tf ON tf.tenant_id = f.tenant_id;

COMMENT ON VIEW public.vista_factura_impresion IS
  'Factura para impresión: emisor mostrado con nombre comercial del local (tenants.nombre).';

GRANT SELECT ON public.vista_factura_impresion TO anon;
GRANT SELECT ON public.vista_factura_impresion TO authenticated;
