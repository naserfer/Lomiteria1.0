import { createClient } from '@/lib/supabase/client'

/**
 * Nombre del canal exclusivo para broadcast manual de cambios de mesa.
 * Es deliberadamente distinto de `mesas-tenant-<id>` (el canal con
 * postgres_changes) para que el helper pueda hacer `removeChannel` sin
 * cerrar el canal CDC que `useRealtimeMesas` mantiene vivo.
 */
export const mesasBroadcastChannelName = (tenantId: string) =>
  `mesas-broadcast-${tenantId}`

/**
 * Eventos broadcast que viajan por el canal `mesas-broadcast-<tenantId>`.
 * El hook `useRealtimeMesas` los traduce a sus handlers (onMesasChange,
 * onReservasChange, onUnionesChange, etc.).
 */
export type MesasBroadcastEvent =
  | 'mesas:changed'
  | 'reservas:changed'
  | 'uniones:changed'

/**
 * Emisor genérico de broadcast. Reusa la instancia del canal si el cliente ya
 * lo tiene suscripto (porque `useRealtimeMesas` está montado en otra
 * pantalla); si no, abre uno efímero, espera SUBSCRIBED, envía y limpia.
 *
 * Por qué existe este helper:
 *   El stream `postgres_changes` de Supabase Realtime, en este proyecto, deja
 *   los canales en `SUBSCRIBED` pero no entrega payloads (síntoma confirmado
 *   durante el debug). El broadcast manual es la red de seguridad: cualquier
 *   mutación emite el evento, así los demás clientes reaccionan al instante
 *   sin depender del CDC. Si Postgres Changes vuelve a funcionar bien, este
 *   broadcast es redundante pero no estorba (el debounce del hook coalesce
 *   ráfagas).
 *
 * Es resistente a fallos: si el canal no llega a SUBSCRIBED en `timeoutMs`,
 * loggea warning y no rompe el flujo de la mutación.
 */
async function emitBroadcast(
  tenantId: string,
  event: MesasBroadcastEvent,
  reason: string,
  timeoutMs: number,
): Promise<void> {
  if (!tenantId) return
  const supabase = createClient()
  const channelName = mesasBroadcastChannelName(tenantId)
  const payload = { reason, at: new Date().toISOString() }

  const existing = supabase.getChannels().find((c) => c.topic === `realtime:${channelName}`)
  if (existing && existing.state === 'joined') {
    try {
      await existing.send({ type: 'broadcast', event, payload })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[mesasBroadcast] reuse send failed', { tenantId, event, reason, error: (e as Error)?.message })
    }
    return
  }

  const channel = supabase.channel(channelName, {
    config: { broadcast: { self: false, ack: false } },
  })

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('broadcast subscribe timeout')), timeoutMs)
      channel.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timer)
          resolve()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          clearTimeout(timer)
          reject(err ?? new Error(`broadcast channel ${status}`))
        }
      })
    })

    await channel.send({ type: 'broadcast', event, payload })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[mesasBroadcast] failed', { tenantId, event, reason, error: (e as Error)?.message })
  } finally {
    await supabase.removeChannel(channel).catch(() => {})
  }
}

/** Notifica que el estado de una mesa cambió (ocupar/liberar/etc). */
export function broadcastMesasChanged(tenantId: string, reason: string = 'mutation', timeoutMs: number = 2000) {
  return emitBroadcast(tenantId, 'mesas:changed', reason, timeoutMs)
}

/** Notifica que se creó/editó/canceló/eliminó una reserva. */
export function broadcastReservasChanged(tenantId: string, reason: string = 'mutation', timeoutMs: number = 2000) {
  return emitBroadcast(tenantId, 'reservas:changed', reason, timeoutMs)
}

/** Notifica que cambió una unión de mesas. */
export function broadcastUnionesChanged(tenantId: string, reason: string = 'mutation', timeoutMs: number = 2000) {
  return emitBroadcast(tenantId, 'uniones:changed', reason, timeoutMs)
}
