-- ============================================
-- MESAS MULTITENANT (v27)
-- ============================================
-- Crea el módulo de mesas:
-- - catálogo de mesas
-- - reservas
-- - uniones de mesas
-- - eventos/auditoría
-- - vínculo de pedidos -> mesa
-- - relaciones para división de cuentas
--
-- Nota: este proyecto trabaja mayormente sin RLS en runtime.
-- Se mantienen grants alineados a tablas operativas existentes.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------
-- 1) Mesas por tenant
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.mesas (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  numero integer NOT NULL CHECK (numero > 0),
  nombre text,
  capacidad integer NOT NULL DEFAULT 4 CHECK (capacidad > 0),
  estado text NOT NULL DEFAULT 'libre'
    CHECK (estado IN ('libre', 'ocupada', 'reservada', 'bloqueada')),
  activa boolean NOT NULL DEFAULT true,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_mesas_tenant_estado
  ON public.mesas(tenant_id, estado);
CREATE INDEX IF NOT EXISTS idx_mesas_tenant_orden
  ON public.mesas(tenant_id, orden, numero);

-- --------------------------------------------
-- 2) Extensión de pedidos para mesa
-- --------------------------------------------
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS mesa_id uuid REFERENCES public.mesas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_tenant_mesa
  ON public.pedidos(tenant_id, mesa_id);

-- --------------------------------------------
-- 3) Reservas de mesas
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.mesa_reservas (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  mesa_id uuid NOT NULL REFERENCES public.mesas(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  nombre_reserva text NOT NULL,
  telefono text,
  cantidad_personas integer CHECK (cantidad_personas IS NULL OR cantidad_personas > 0),
  inicio_at timestamptz NOT NULL,
  fin_at timestamptz,
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'confirmada', 'cancelada', 'completada', 'no_show')),
  notas text,
  created_by uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mesa_reservas_tenant_inicio
  ON public.mesa_reservas(tenant_id, inicio_at DESC);
CREATE INDEX IF NOT EXISTS idx_mesa_reservas_tenant_estado
  ON public.mesa_reservas(tenant_id, estado);
CREATE INDEX IF NOT EXISTS idx_mesa_reservas_mesa
  ON public.mesa_reservas(tenant_id, mesa_id, inicio_at DESC);

-- --------------------------------------------
-- 4) Unión de mesas
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.mesa_uniones (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  codigo text,
  estado text NOT NULL DEFAULT 'activa'
    CHECK (estado IN ('activa', 'cerrada')),
  created_by uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_mesa_uniones_tenant_estado
  ON public.mesa_uniones(tenant_id, estado, created_at DESC);

CREATE TABLE IF NOT EXISTS public.mesa_union_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  union_id uuid NOT NULL REFERENCES public.mesa_uniones(id) ON DELETE CASCADE,
  mesa_id uuid NOT NULL REFERENCES public.mesas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (union_id, mesa_id)
);

CREATE INDEX IF NOT EXISTS idx_mesa_union_items_tenant_union
  ON public.mesa_union_items(tenant_id, union_id);
CREATE INDEX IF NOT EXISTS idx_mesa_union_items_tenant_mesa
  ON public.mesa_union_items(tenant_id, mesa_id);

-- --------------------------------------------
-- 5) División de pedidos (cuentas divididas)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.pedido_divisiones (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  pedido_padre_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  pedido_hijo_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  monto numeric NOT NULL DEFAULT 0 CHECK (monto >= 0),
  created_by uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pedido_padre_id, pedido_hijo_id)
);

CREATE INDEX IF NOT EXISTS idx_pedido_divisiones_tenant_padre
  ON public.pedido_divisiones(tenant_id, pedido_padre_id);
CREATE INDEX IF NOT EXISTS idx_pedido_divisiones_tenant_hijo
  ON public.pedido_divisiones(tenant_id, pedido_hijo_id);

-- --------------------------------------------
-- 6) Eventos de mesa (auditoría de acciones)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.mesa_eventos (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  mesa_id uuid REFERENCES public.mesas(id) ON DELETE SET NULL,
  pedido_id uuid REFERENCES public.pedidos(id) ON DELETE SET NULL,
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (
    tipo IN (
      'crear_mesa',
      'editar_mesa',
      'ocupar_mesa',
      'liberar_mesa',
      'bloquear_mesa',
      'reservar_mesa',
      'cancelar_reserva',
      'confirmar_reserva',
      'mover_pedido',
      'unir_mesas',
      'cerrar_union',
      'dividir_cuenta'
    )
  ),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mesa_eventos_tenant_fecha
  ON public.mesa_eventos(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mesa_eventos_tenant_mesa
  ON public.mesa_eventos(tenant_id, mesa_id, created_at DESC);

-- --------------------------------------------
-- 7) Funciones utilitarias del módulo
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at_mesas()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_updated_at_mesas ON public.mesas;
CREATE TRIGGER trg_set_updated_at_mesas
BEFORE UPDATE ON public.mesas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_mesas();

DROP TRIGGER IF EXISTS trg_set_updated_at_mesa_reservas ON public.mesa_reservas;
CREATE TRIGGER trg_set_updated_at_mesa_reservas
BEFORE UPDATE ON public.mesa_reservas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_mesas();

CREATE OR REPLACE FUNCTION public.ocupar_mesa(
  p_tenant_id uuid,
  p_mesa_id uuid,
  p_usuario_id uuid DEFAULT NULL,
  p_pedido_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.mesas
  SET estado = 'ocupada', updated_at = now()
  WHERE id = p_mesa_id
    AND tenant_id = p_tenant_id
    AND activa = true
    AND estado <> 'bloqueada';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se pudo ocupar la mesa. Verificá estado o tenant.';
  END IF;

  INSERT INTO public.mesa_eventos (tenant_id, mesa_id, pedido_id, usuario_id, tipo, payload)
  VALUES (p_tenant_id, p_mesa_id, p_pedido_id, p_usuario_id, 'ocupar_mesa', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.liberar_mesa(
  p_tenant_id uuid,
  p_mesa_id uuid,
  p_usuario_id uuid DEFAULT NULL,
  p_pedido_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.mesas
  SET estado = 'libre', updated_at = now()
  WHERE id = p_mesa_id
    AND tenant_id = p_tenant_id
    AND activa = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se pudo liberar la mesa. Verificá tenant.';
  END IF;

  INSERT INTO public.mesa_eventos (tenant_id, mesa_id, pedido_id, usuario_id, tipo, payload)
  VALUES (p_tenant_id, p_mesa_id, p_pedido_id, p_usuario_id, 'liberar_mesa', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.mover_pedido_mesa(
  p_tenant_id uuid,
  p_pedido_id uuid,
  p_mesa_destino_id uuid,
  p_usuario_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_mesa_origen_id uuid;
BEGIN
  SELECT mesa_id
    INTO v_mesa_origen_id
  FROM public.pedidos
  WHERE id = p_pedido_id
    AND tenant_id = p_tenant_id;

  UPDATE public.pedidos
  SET mesa_id = p_mesa_destino_id,
      updated_at = now()
  WHERE id = p_pedido_id
    AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró el pedido para mover de mesa.';
  END IF;

  IF v_mesa_origen_id IS NOT NULL THEN
    PERFORM public.liberar_mesa(p_tenant_id, v_mesa_origen_id, p_usuario_id, p_pedido_id);
  END IF;

  PERFORM public.ocupar_mesa(p_tenant_id, p_mesa_destino_id, p_usuario_id, p_pedido_id);

  INSERT INTO public.mesa_eventos (tenant_id, mesa_id, pedido_id, usuario_id, tipo, payload)
  VALUES (
    p_tenant_id,
    p_mesa_destino_id,
    p_pedido_id,
    p_usuario_id,
    'mover_pedido',
    jsonb_build_object('mesa_origen_id', v_mesa_origen_id, 'mesa_destino_id', p_mesa_destino_id)
  );
END;
$$;

-- --------------------------------------------
-- 8) Grants
-- --------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mesas TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mesa_reservas TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mesa_uniones TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mesa_union_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pedido_divisiones TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mesa_eventos TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.mesa_eventos_id_seq TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ocupar_mesa(uuid, uuid, uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.liberar_mesa(uuid, uuid, uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mover_pedido_mesa(uuid, uuid, uuid, uuid) TO anon, authenticated;

COMMIT;
