-- Notas por ítem en vista de ticket cocina (reimpresión HTTP alineada al ticket original)
DROP VIEW IF EXISTS public.vista_items_ticket_cocina;
CREATE VIEW public.vista_items_ticket_cocina AS
SELECT
  ip.pedido_id,
  -- Mantener orden estable para el agente (que ordena por item_pedido_id).
  -- Si `orden_ticket` existe, lo usamos; si no, caemos a created_at.
  lpad(
    (
      COALESCE(
        CASE WHEN cat.nombre = 'Salsas' THEN 900000 ELSE 0 END,
        0
      )
      + COALESCE(ip.orden_ticket, 0)
    )::text,
    6,
    '0'
  ) || '_' || ip.id::text AS item_pedido_id,
  ip.id AS item_pedido_uuid,
  ip.producto_nombre,
  ip.cantidad,
  ip.precio_unitario,
  ip.subtotal,
  ip.notas AS notas_item,
  COALESCE(
    (
      SELECT string_agg(
        CASE c.tipo
          WHEN 'removido' THEN 'Sin ' || COALESCE(i.nombre, c.motivo, 'ingrediente')
          WHEN 'extra' THEN
            'Extra ' || COALESCE(i.nombre, c.motivo, 'ingrediente')
            || CASE
              WHEN COALESCE(c.precio_extra, 0) > 0
                THEN ' Gs. ' || to_char(round(c.precio_extra)::bigint, 'FM999G999G999G990')
              ELSE ''
            END
          WHEN 'modificado' THEN
            COALESCE(i.nombre, c.motivo, 'ingrediente')
            || ' ' || c.cantidad_original::TEXT || '→' || c.cantidad_ajustada::TEXT
          ELSE COALESCE(i.nombre, c.motivo, 'ingrediente')
        END,
        ' · '
        ORDER BY c.tipo, COALESCE(i.nombre, c.motivo, 'ingrediente')
      )
      FROM items_pedido_customizacion c
      LEFT JOIN ingredientes i ON i.id = c.ingrediente_id
      WHERE c.item_pedido_id = ip.id
    ),
    ''
  ) AS modificaciones
FROM items_pedido ip
LEFT JOIN productos p ON p.id = ip.producto_id
LEFT JOIN categorias cat ON cat.id = p.categoria_id;

COMMENT ON VIEW vista_items_ticket_cocina IS 'Items de pedido con texto de modificaciones para ticket de cocina (sin X, extra Y) y notas por ítem.';

GRANT SELECT ON vista_items_ticket_cocina TO anon;
GRANT SELECT ON vista_items_ticket_cocina TO authenticated;
