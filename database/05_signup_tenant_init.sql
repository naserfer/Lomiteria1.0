-- ============================================
-- FUNCIÓN DE INICIALIZACIÓN DE NUEVO TENANT
-- Version: 1.0
-- Descripción: Función PL/pgSQL que inicializa
--   datos por defecto para un tenant recién creado
--   via el flujo de SignUp.
-- ============================================

-- Función para inicializar datos de un nuevo tenant
CREATE OR REPLACE FUNCTION initialize_new_tenant(
  p_tenant_id UUID,
  p_nombre_negocio TEXT DEFAULT 'Mi Negocio'
)
RETURNS VOID AS $$
BEGIN
  -- Insertar categorías por defecto solo si el tenant no tiene ninguna
  IF NOT EXISTS (SELECT 1 FROM categorias WHERE tenant_id = p_tenant_id LIMIT 1) THEN
    INSERT INTO categorias (tenant_id, nombre, descripcion, orden, activa) VALUES
      (p_tenant_id, 'Hamburguesas', 'Hamburguesas y sándwiches', 1, true),
      (p_tenant_id, 'Bebidas', 'Bebidas frías y calientes', 2, true),
      (p_tenant_id, 'Entradas', 'Entradas y acompañamientos', 3, true),
      (p_tenant_id, 'Postres', 'Postres y dulces', 4, true);
  END IF;

  RAISE NOTICE '✅ Tenant % inicializado correctamente con datos por defecto', p_nombre_negocio;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION initialize_new_tenant(UUID, TEXT) IS
  'Inicializa datos por defecto (categorías) para un tenant recién creado via SignUp. '
  'Usar SECURITY DEFINER para que pueda insertar aunque RLS esté activo.';

-- ============================================
-- ✅ MIGRACIÓN COMPLETADA
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migración 05_signup_tenant_init completada';
  RAISE NOTICE '   Función initialize_new_tenant() disponible para uso en SignUp';
END $$;
