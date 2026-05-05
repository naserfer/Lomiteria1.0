'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { mesasBroadcastChannelName } from '../services/mesasRealtimeBroadcast'

export interface UseRealtimeMesasHandlers {
  /** La fila de una mesa cambió (estado, nombre, capacidad, orden, activa). */
  onMesasChange?: () => void
  /**
   * Cambios que invalidan el resumen de pedidos por mesa:
   * INSERT/UPDATE/DELETE en pedidos, items_pedido, items_pedido_customizacion o
   * un nuevo evento liberar_mesa que mueve el cutoff de sesión.
   */
  onResumenInvalidate?: () => void
  /** Reservas creadas, editadas, canceladas o eliminadas. */
  onReservasChange?: () => void
  /** Cambios en uniones de mesas o sus items. */
  onUnionesChange?: () => void
}

/**
 * Suscribe al canal realtime de Supabase los streams de tablas relevantes para
 * la vista de gestión de mesas, todos filtrados por tenant donde la columna
 * `tenant_id` existe.
 *
 * Notas:
 * - `items_pedido` e `items_pedido_customizacion` no tienen `tenant_id` propio
 *   (lo heredan vía FK al pedido). Se suscriben sin filtro y se invalida el
 *   resumen con debounce; las recargas siempre traen datos filtrados por tenant
 *   desde el servicio, así que no hay fuga de datos — sólo refetch extra cuando
 *   otro tenant del mismo proyecto está activo.
 * - Los handlers se aplican con debounce para coalescer ráfagas de cambios.
 */
export function useRealtimeMesas(
  tenantId: string | null | undefined,
  handlers: UseRealtimeMesasHandlers,
  debounceMs: number = 400,
) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!tenantId) return
    const supabase = createClient()
    const tenantFilter = `tenant_id=eq.${tenantId}`

    const timers: Record<string, ReturnType<typeof setTimeout> | null> = {
      mesas: null, resumen: null, reservas: null, uniones: null,
    }
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null
    let broadcastChannel: ReturnType<typeof supabase.channel> | null = null

    const fire = (key: keyof typeof timers, cb?: () => void) => {
      if (!cb) return
      if (timers[key]) clearTimeout(timers[key]!)
      timers[key] = setTimeout(() => cb(), debounceMs)
    }

    // Logs de diagnóstico — se pueden remover una vez confirmado el flujo.
    const debug = (msg: string, extra?: unknown) => {
      // eslint-disable-next-line no-console
      console.log(`[useRealtimeMesas] ${msg}`, extra ?? '')
    }

    // Inyectar el JWT de la sesión actual al socket de Realtime ANTES de
    // suscribirse. Sin esto el cliente conecta como `anon` y, si los GRANTs
    // no permiten lectura a anon, los eventos llegan al broker pero nunca al
    // cliente (queda en SUBSCRIBED sin recibir payloads).
    const setupAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (token) {
          // setAuth es síncrono y actualiza también el realtime de v2.
          await supabase.realtime.setAuth(token)
          debug('auth token attached to realtime socket')
        } else {
          debug('no session token — connecting as anon')
        }
      } catch (e) {
        debug('setAuth error', e)
      }
    }

    debug('subscribing', { tenantId, channel: `mesas-tenant-${tenantId}` })

    void setupAuth().then(() => {
      if (cancelled) return
      // Canal aparte SOLO para broadcast manual emitido por las mutaciones
      // (setEstadoMesa, confirmOrder, cerrarCuenta, createReserva, etc). Va en
      // su propio canal (`mesas-broadcast-<id>`) para que el helper sender
      // pueda hacer removeChannel sin afectar el canal CDC de abajo.
      broadcastChannel = supabase
        .channel(mesasBroadcastChannelName(tenantId))
        .on('broadcast', { event: 'mesas:changed' }, (payload) => {
          debug('event broadcast mesas:changed', payload?.payload)
          fire('mesas', handlersRef.current.onMesasChange)
          fire('resumen', handlersRef.current.onResumenInvalidate)
        })
        .on('broadcast', { event: 'reservas:changed' }, (payload) => {
          debug('event broadcast reservas:changed', payload?.payload)
          fire('reservas', handlersRef.current.onReservasChange)
        })
        .on('broadcast', { event: 'uniones:changed' }, (payload) => {
          debug('event broadcast uniones:changed', payload?.payload)
          fire('uniones', handlersRef.current.onUnionesChange)
        })
        .subscribe((status) => {
          debug('broadcast subscribe status', { status })
        })

      channel = supabase
        .channel(`mesas-tenant-${tenantId}`)
        // Mesas: estado, nombre, capacidad, orden, activa.
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas', filter: tenantFilter },
          (payload) => {
            debug('event mesas', { eventType: payload.eventType, new: payload.new, old: payload.old })
            fire('mesas', handlersRef.current.onMesasChange)
            // Cambio de estado puede requerir reabrir/cerrar resumen.
            fire('resumen', handlersRef.current.onResumenInvalidate)
          })
        // Pedidos: total, estado, items asociados.
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos', filter: tenantFilter },
          (payload) => {
            debug('event pedidos', { eventType: payload.eventType })
            fire('resumen', handlersRef.current.onResumenInvalidate)
          })
        // Eventos de mesa (liberar_mesa mueve el cutoff de sesión).
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mesa_eventos', filter: tenantFilter },
          (payload) => {
            debug('event mesa_eventos', { tipo: (payload.new as { tipo?: string } | null)?.tipo })
            fire('resumen', handlersRef.current.onResumenInvalidate)
          })
        // items_pedido / customizaciones: sin tenant_id (heredado).
        .on('postgres_changes', { event: '*', schema: 'public', table: 'items_pedido' },
          () => fire('resumen', handlersRef.current.onResumenInvalidate))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'items_pedido_customizacion' },
          () => fire('resumen', handlersRef.current.onResumenInvalidate))
        // Reservas.
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mesa_reservas', filter: tenantFilter },
          () => fire('reservas', handlersRef.current.onReservasChange))
        // Uniones.
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mesa_uniones', filter: tenantFilter },
          () => fire('uniones', handlersRef.current.onUnionesChange))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mesa_union_items', filter: tenantFilter },
          () => fire('uniones', handlersRef.current.onUnionesChange))
        .subscribe((status, err) => {
          debug('subscribe status', { status, err: err?.message })
        })
    })

    return () => {
      cancelled = true
      for (const key of Object.keys(timers) as Array<keyof typeof timers>) {
        if (timers[key]) clearTimeout(timers[key]!)
      }
      if (channel) void supabase.removeChannel(channel)
      if (broadcastChannel) void supabase.removeChannel(broadcastChannel)
    }
  }, [tenantId, debounceMs])
}
