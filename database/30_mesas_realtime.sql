-- ============================================================================
-- 30_mesas_realtime.sql
--
-- Habilita Supabase Realtime para `public.mesas` y `public.mesa_eventos`.
--
-- Por qué:
--   - El front se suscribe a `postgres_changes` con filtro `tenant_id=eq.<id>`
--     en MesasView (admin/caja) y MesaPickerScreen (mozos en POS) para
--     reaccionar a cambios de estado de mesa sin que el usuario haga refresh.
--   - Para que el filtrado por columna funcione en eventos UPDATE/DELETE el
--     publisher tiene que enviar también la fila previa, lo que requiere
--     `REPLICA IDENTITY FULL`. Con DEFAULT (sólo PK) los UPDATE no traen el
--     `tenant_id` viejo y el filtrado server-side puede descartar el evento.
--   - La pertenencia a `supabase_realtime` puede haberse seteado desde el
--     Dashboard en algún ambiente y faltar en otros (dev/preview). Hacerlo
--     idempotente desde migración garantiza paridad entre ambientes.
--
-- Idempotente: corre en cualquier orden y múltiples veces sin error.
-- ============================================================================

ALTER TABLE public.mesas         REPLICA IDENTITY FULL;
ALTER TABLE public.mesa_eventos  REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.mesas;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'Publication supabase_realtime no existe; habilitá Realtime para `mesas` desde el dashboard.';
  WHEN duplicate_object THEN
    NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.mesa_eventos;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'Publication supabase_realtime no existe; habilitá Realtime para `mesa_eventos` desde el dashboard.';
  WHEN duplicate_object THEN
    NULL;
END;
$$;

-- Realtime entrega eventos respetando los permisos del rol con el que se conecta
-- el websocket (anon si el cliente no inyectó JWT, authenticated si sí). Sin RLS
-- igual hace falta el GRANT SELECT explícito; de lo contrario la suscripción
-- queda en SUBSCRIBED pero nunca recibe payloads.
GRANT SELECT ON public.mesas        TO anon, authenticated;
GRANT SELECT ON public.mesa_eventos TO anon, authenticated;
