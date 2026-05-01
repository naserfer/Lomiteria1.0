'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { EstadoMesa, Mesa } from '../types/mesas.types'

export interface UseRealtimeMesaDetalleHandlers {
  /**
   * Se invoca cuando la mesa observada deja de estar `ocupada` por una acción
   * remota (típicamente, otro usuario cerró la cuenta o la liberó). Sirve para
   * que el modal de detalle muestre un aviso y se cierre.
   */
  onMesaLiberadaRemoto?: (nuevoEstado: EstadoMesa) => void
  /**
   * Se invoca con la fila completa de la mesa cada vez que cambia. Útil si el
   * consumidor quiere reaccionar a renombres, cambios de capacidad, etc., con
   * latencia menor que el debounce del listener tenant-level.
   */
  onMesaUpdate?: (mesa: Mesa) => void
}

/**
 * Listener focalizado en una sola mesa cuando el modal de detalle está abierto.
 * Está pensado para complementar `useRealtimeMesas`, no para reemplazarlo: éste
 * notifica de forma inmediata (sin debounce) los cambios de estado de la mesa
 * para que el modal pueda reaccionar rápido a una acción remota.
 */
export function useRealtimeMesaDetalle(
  tenantId: string | null | undefined,
  mesa: Mesa | null,
  handlers: UseRealtimeMesaDetalleHandlers,
) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers
  const lastEstadoRef = useRef<EstadoMesa | null>(mesa?.estado ?? null)

  useEffect(() => {
    lastEstadoRef.current = mesa?.estado ?? null
  }, [mesa?.id])

  const mesaId = mesa?.id ?? null

  useEffect(() => {
    if (!tenantId || !mesaId) return
    const supabase = createClient()

    const channel = supabase
      .channel(`mesa-detalle-${tenantId}-${mesaId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'mesas',
          filter: `id=eq.${mesaId}`,
        },
        (payload) => {
          const nuevo = payload.new as Mesa | null
          if (!nuevo) return
          handlersRef.current.onMesaUpdate?.(nuevo)
          const prevEstado = lastEstadoRef.current
          lastEstadoRef.current = nuevo.estado
          if (prevEstado === 'ocupada' && nuevo.estado !== 'ocupada') {
            handlersRef.current.onMesaLiberadaRemoto?.(nuevo.estado)
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [tenantId, mesaId])
}
