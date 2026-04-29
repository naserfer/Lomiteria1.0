-- Módulo de Delivery por tenant: cada local puede habilitar o deshabilitar
-- la opción de tomar pedidos de tipo "delivery" desde el POS.
-- Por defecto desactivado (false) para todos los tenants existentes.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS has_delivery BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tenants.has_delivery IS
  'Habilita la opción de pedidos Delivery en el POS. false = solo Comer aquí y Para llevar.';

-- Tenant específico: Lomiteria Oriental no ofrece delivery.
UPDATE public.tenants
  SET has_delivery = false
  WHERE id = '565c0876-2235-4e7c-bb54-89c466fe4583';
