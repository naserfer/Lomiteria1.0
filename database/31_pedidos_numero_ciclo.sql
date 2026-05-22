-- =============================================================================
-- Migración: Numeración cíclica de pedidos por tenant (1..999 + ciclo)
-- Fecha: 2026-05-19
--
-- Objetivo:
--   - Mantener numero_pedido en rango 1..999
--   - Reiniciar a 1 al llegar a 999
--   - Evitar colisiones históricas sin borrar pedidos
--   - Soportar tenants actuales y futuros
-- =============================================================================

BEGIN;

-- 1) Extender pedidos con pedido_ciclo (histórico arranca en ciclo 1)
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS pedido_ciclo INTEGER;

UPDATE public.pedidos
SET pedido_ciclo = 1
WHERE pedido_ciclo IS NULL;

ALTER TABLE public.pedidos
  ALTER COLUMN pedido_ciclo SET DEFAULT 1,
  ALTER COLUMN pedido_ciclo SET NOT NULL;

COMMENT ON COLUMN public.pedidos.pedido_ciclo IS
  'Ciclo de numeración por tenant. numero_pedido mantiene rango 1..999 y pedido_ciclo diferencia históricos.';

-- 2) Extender contador por tenant con ciclo actual
ALTER TABLE public.tenant_pedido_counters
  ADD COLUMN IF NOT EXISTS ciclo_actual INTEGER;

UPDATE public.tenant_pedido_counters
SET ciclo_actual = 1
WHERE ciclo_actual IS NULL;

ALTER TABLE public.tenant_pedido_counters
  ALTER COLUMN ciclo_actual SET DEFAULT 1,
  ALTER COLUMN ciclo_actual SET NOT NULL;

COMMENT ON COLUMN public.tenant_pedido_counters.ciclo_actual IS
  'Ciclo vigente de numeración de pedidos (se incrementa cuando ultimo_numero pasa de 999 a 1).';

-- 3) Reconciliar counters para tenants existentes
WITH resumen AS (
  SELECT
    p.tenant_id,
    COALESCE(MAX(p.numero_pedido), 0) AS max_numero,
    COALESCE(MAX(p.pedido_ciclo), 1) AS max_ciclo
  FROM public.pedidos p
  GROUP BY p.tenant_id
)
INSERT INTO public.tenant_pedido_counters (tenant_id, ultimo_numero, ciclo_actual, updated_at)
SELECT r.tenant_id, r.max_numero, r.max_ciclo, NOW()
FROM resumen r
ON CONFLICT (tenant_id) DO UPDATE
SET ultimo_numero = GREATEST(public.tenant_pedido_counters.ultimo_numero, EXCLUDED.ultimo_numero),
    ciclo_actual = GREATEST(public.tenant_pedido_counters.ciclo_actual, EXCLUDED.ciclo_actual),
    updated_at = NOW();

-- 4) Nueva unicidad por tenant + ciclo + número
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'pedidos'
      AND c.conname = 'pedidos_tenant_id_numero_pedido_key'
  ) THEN
    ALTER TABLE public.pedidos
      DROP CONSTRAINT pedidos_tenant_id_numero_pedido_key;
  END IF;
END $$;

ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_tenant_id_pedido_ciclo_numero_pedido_key
  UNIQUE (tenant_id, pedido_ciclo, numero_pedido);

-- 5) Función interna: devuelve número + ciclo y actualiza contador de forma atómica
CREATE OR REPLACE FUNCTION public.obtener_siguiente_numeracion_pedido(p_tenant_id UUID)
RETURNS TABLE(numero_pedido INTEGER, pedido_ciclo INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ultimo_numero INTEGER;
  v_ciclo_actual INTEGER;
BEGIN
  INSERT INTO public.tenant_pedido_counters (tenant_id, ultimo_numero, ciclo_actual, updated_at)
  VALUES (p_tenant_id, 0, 1, NOW())
  ON CONFLICT (tenant_id) DO NOTHING;

  SELECT tpc.ultimo_numero, tpc.ciclo_actual
  INTO v_ultimo_numero, v_ciclo_actual
  FROM public.tenant_pedido_counters tpc
  WHERE tpc.tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_ultimo_numero >= 999 THEN
    v_ultimo_numero := 1;
    v_ciclo_actual := v_ciclo_actual + 1;
  ELSE
    v_ultimo_numero := v_ultimo_numero + 1;
  END IF;

  UPDATE public.tenant_pedido_counters
  SET ultimo_numero = v_ultimo_numero,
      ciclo_actual = v_ciclo_actual,
      updated_at = NOW()
  WHERE tenant_id = p_tenant_id;

  RETURN QUERY SELECT v_ultimo_numero, v_ciclo_actual;
END;
$$;

COMMENT ON FUNCTION public.obtener_siguiente_numeracion_pedido(UUID) IS
  'Asigna numeración cíclica 1..999 por tenant y avanza pedido_ciclo al reiniciar en 1.';

-- 6) Compatibilidad: mantener firma antigua (retorna solo número)
CREATE OR REPLACE FUNCTION public.obtener_siguiente_numero_pedido(p_tenant_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero INTEGER;
BEGIN
  SELECT n.numero_pedido
  INTO v_numero
  FROM public.obtener_siguiente_numeracion_pedido(p_tenant_id) n;

  RETURN v_numero;
END;
$$;

COMMENT ON FUNCTION public.obtener_siguiente_numero_pedido(UUID) IS
  'Wrapper compatible: devuelve solo numero_pedido usando la lógica por ciclo.';

-- 7) Trigger: asigna numero + ciclo automáticamente
CREATE OR REPLACE FUNCTION public.asignar_numero_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_numero INTEGER;
  v_ciclo INTEGER;
BEGIN
  IF NEW.numero_pedido IS NOT NULL AND NEW.pedido_ciclo IS NULL THEN
    RAISE EXCEPTION
      'pedido_ciclo es obligatorio cuando se envía numero_pedido manualmente';
  END IF;

  -- Sin numero_pedido: asignar ambos (ignora DEFAULT pedido_ciclo = 1 en la columna)
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

DROP TRIGGER IF EXISTS trigger_asignar_numero_pedido ON public.pedidos;
CREATE TRIGGER trigger_asignar_numero_pedido
  BEFORE INSERT ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.asignar_numero_pedido();

COMMIT;
