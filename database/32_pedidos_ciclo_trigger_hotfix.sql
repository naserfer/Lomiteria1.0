-- Hotfix: trigger de numeración vs DEFAULT pedido_ciclo = 1
-- Problema: INSERT sin numero_pedido dejaba pedido_ciclo=1 por DEFAULT y el trigger fallaba.
-- Ejecutar en Supabase SQL Editor (Run without RLS).

BEGIN;

CREATE OR REPLACE FUNCTION public.asignar_numero_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_numero INTEGER;
  v_ciclo INTEGER;
BEGIN
  -- Solo error si envían número manual sin ciclo
  IF NEW.numero_pedido IS NOT NULL AND NEW.pedido_ciclo IS NULL THEN
    RAISE EXCEPTION
      'pedido_ciclo es obligatorio cuando se envía numero_pedido manualmente';
  END IF;

  -- Flujo normal de la app: sin numero_pedido → asignar ambos (ignora DEFAULT de pedido_ciclo)
  IF NEW.numero_pedido IS NULL THEN
    SELECT n.numero_pedido, n.pedido_ciclo
    INTO v_numero, v_ciclo
    FROM public.obtener_siguiente_numeracion_pedido(NEW.tenant_id) n;

    NEW.numero_pedido := v_numero;
    NEW.pedido_ciclo := v_ciclo;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
