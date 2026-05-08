'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, Table2, RefreshCw, ShoppingBag, Eye,
} from 'lucide-react'
import type { ResumenMesa } from '@/features/mesas/types/mesas.types'
import { useTenant } from '@/contexts/TenantContext'
import { mesasService } from '@/features/mesas/services/mesasService'
import { cerrarCuentaMesaService } from '@/features/mesas/services/cerrarCuentaMesaService'
import { useRealtimeMesas } from '@/features/mesas/hooks/useRealtimeMesas'
import { ROUTES } from '@/config/routes'
import { MesaPedidoCocinaToastHost } from './MesaPedidoCocinaToastHost'
import type { EstadoMesa, Mesa, MesaReserva } from '@/features/mesas/types/mesas.types'
import { DetalleMesaModal } from '@/features/mesas/components/DetalleMesaModal'

// ─── Estilos por estado ───────────────────────────────────────────────────────

const ESTADO_BADGE: Record<EstadoMesa, string> = {
  libre: 'bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-500 dark:border-emerald-500',
  ocupada: 'bg-red-600 text-white border-red-600 dark:bg-red-500 dark:border-red-500',
  reservada: 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500',
  bloqueada: 'bg-gray-500 text-white border-gray-500 dark:bg-gray-600 dark:border-gray-600',
}

const ESTADO_BORDER: Record<EstadoMesa, string> = {
  libre: 'border-emerald-500 dark:border-emerald-600',
  ocupada: 'border-red-600 dark:border-red-600',
  reservada: 'border-blue-500 dark:border-blue-600',
  bloqueada: 'border-gray-400 dark:border-gray-700',
}

const ESTADO_CARD_BG: Record<EstadoMesa, string> = {
  libre: 'bg-emerald-50/70 dark:bg-emerald-950/20',
  ocupada: 'bg-red-50/70 dark:bg-red-950/20',
  reservada: 'bg-blue-50/50 dark:bg-blue-950/15',
  bloqueada: 'bg-gray-50/80 dark:bg-gray-900/70',
}

const ESTADO_LABEL: Record<EstadoMesa, string> = {
  libre: 'Libre',
  ocupada: 'Ocupada',
  reservada: 'Reservada',
  bloqueada: 'Bloqueada',
}

const isVirtualTakeawayMesa = (mesa: Mesa | null | undefined) => {
  const name = (mesa?.nombre ?? '').toLowerCase()
  return name === '__virtual_para_llevar__' || name.includes('virtual_para_llevar')
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface MesaPickerScreenProps {
  tenantId: string
  onSinMesa: () => void
}

export function MesaPickerScreen({ tenantId, onSinMesa }: MesaPickerScreenProps) {
  const router = useRouter()
  const { darkMode, usuario } = useTenant()

  const [mesas,          setMesas]          = useState<Mesa[]>([])
  const [reservas,       setReservas]       = useState<MesaReserva[]>([])
  const [loading,        setLoading]        = useState(true)
  const [refreshing,     setRefreshing]     = useState(false)
  const [navigatingTo,   setNavigatingTo]   = useState<string | null>(null)
  const [selectedMesaId, setSelectedMesaId] = useState<string | null>(null)
  const [closingCuentaMesaId, setClosingCuentaMesaId] = useState<string | null>(null)
  const [mesaFeedbackById, setMesaFeedbackById] = useState<Record<string, { type: 'success' | 'error'; message: string }>>({})
  const [resumenByMesa,  setResumenByMesa]  = useState<Record<string, ResumenMesa>>({})
  const [loadingResumen, setLoadingResumen] = useState(false)
  const [updatingExtraPrecioId, setUpdatingExtraPrecioId] = useState<string | null>(null)
  const [updatingItemRecargoId, setUpdatingItemRecargoId] = useState<string | null>(null)
  const [addingManualItemMesaId, setAddingManualItemMesaId] = useState<string | null>(null)

  const fetchResumenes = useCallback(async (mesasData: Mesa[]) => {
    const ocupadas = mesasData.filter(m => m.estado === 'ocupada')
    if (ocupadas.length === 0) { setResumenByMesa({}); return }
    setLoadingResumen(true)
    try {
      const data = await mesasService.getResumenPedidosMesas(tenantId, ocupadas)
      const map: Record<string, ResumenMesa> = {}
      data.forEach(r => { map[r.mesa_id] = r })
      setResumenByMesa(map)
    } catch {
      // silencioso
    } finally {
      setLoadingResumen(false)
    }
  }, [tenantId])

  const fetchMesas = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const data = await mesasService.listMesas(tenantId)
      setMesas(data)
      void fetchResumenes(data)
    } catch {
      // silent — grid stays with stale data on refresh errors
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [tenantId, fetchResumenes])

  const fetchReservas = useCallback(async () => {
    try {
      const data = await mesasService.listReservas(tenantId)
      setReservas(data)
    } catch {
      // silencioso — sin reservas la card cae al estado base
    }
  }, [tenantId])

  useEffect(() => { void fetchMesas() }, [fetchMesas])
  useEffect(() => { void fetchReservas() }, [fetchReservas])

  // ── Realtime ──────────────────────────────────────────────────────────────────
  // Suscripción compartida con MesasView vía useRealtimeMesas: cuando cualquier
  // usuario del mismo tenant cambia el estado de una mesa (ocupar al confirmar
  // pedido, liberar al cerrar cuenta, bloquear/reservar desde admin) este picker
  // refresca el grid sin necesidad de refresh manual.

  const mesasRef = useRef(mesas)
  useEffect(() => { mesasRef.current = mesas }, [mesas])

  useRealtimeMesas(tenantId, {
    onMesasChange: () => { void fetchMesas(true) },
    onResumenInvalidate: () => { void fetchResumenes(mesasRef.current) },
    onReservasChange: () => { void fetchReservas() },
  })

  // Reservas pendientes / confirmadas desde HOY agrupadas por mesa, para
  // pintar el badge "Próximas reservas" en la card del picker (mismo criterio
  // que MesasView para mantener consistencia entre admin y mozos).
  const reservasActivasPorMesa = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const map = new Map<string, MesaReserva[]>()
    for (const r of reservas) {
      if (!['pendiente', 'confirmada'].includes(r.estado)) continue
      const start = new Date(r.inicio_at)
      const dayStart = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
      if (dayStart < startOfToday) continue
      const list = map.get(r.mesa_id) ?? []
      list.push(r)
      map.set(r.mesa_id, list)
    }
    map.forEach((list, mesaId) => {
      list.sort((a, b) => new Date(a.inicio_at).getTime() - new Date(b.inicio_at).getTime())
      map.set(mesaId, list)
    })
    return map
  }, [reservas])

  const resumen = useMemo(() => ({
    libres:    mesas.filter(m => m.estado === 'libre').length,
    ocupadas:  mesas.filter(m => m.estado === 'ocupada').length,
    reservadas:mesas.filter(m => m.estado === 'reservada').length,
  }), [mesas])

  const selectedMesa = useMemo(
    () => mesas.find(m => m.id === selectedMesaId) ?? null,
    [mesas, selectedMesaId]
  )

  const handleSelect = (mesaId: string) => {
    if (navigatingTo) return
    setSelectedMesaId(null)
    setNavigatingTo(mesaId)
    router.push(`${ROUTES.PROTECTED.POS}?mesaId=${mesaId}&from=${ROUTES.POS_FROM.POS_PICKER}`)
  }

  const handleCerrarCuentaMesa = useCallback(async (mesa: Mesa, metodo?: 'tarjeta' | 'efectivo') => {
    setClosingCuentaMesaId(mesa.id)
    // Snapshot para rollback si el cierre falla.
    const estadoPrevio = mesa.estado
    // Update optimista: la mesa pasa a libre al instante. El realtime confirma
    // a los demás dispositivos del tenant; si falla, revertimos abajo.
    setMesas(prev => prev.map(m => m.id === mesa.id ? { ...m, estado: 'libre' } : m))
    try {
      const result = await cerrarCuentaMesaService.cerrarCuenta({
        tenantId,
        mesaId: mesa.id,
        usuarioId: usuario?.id ?? null,
      })
      const accion = result.warning
        ? 'pendiente/parcial'
        : result.facturaEmitidaAhora
          ? 'emitida e impresa'
          : 'reimpresa'
      setMesaFeedbackById(prev => ({
        ...prev,
        [mesa.id]: {
          type: result.warning ? 'error' : 'success',
          message: result.warning
            ? `Mesa liberada (pedido #${result.numeroPedido}). Atención: ${result.warning}`
            : `Cuenta cerrada (${metodo ?? 'sin método'}) (pedido #${result.numeroPedido}). Factura ${accion}; mesa liberada.`,
        },
      }))
      await fetchMesas(true)
      setSelectedMesaId(null)
    } catch (e: any) {
      setMesas(prev => prev.map(m => m.id === mesa.id ? { ...m, estado: estadoPrevio } : m))
      setMesaFeedbackById(prev => ({
        ...prev,
        [mesa.id]: { type: 'error', message: e?.message ?? 'No se pudo cerrar la cuenta de la mesa.' },
      }))
    } finally {
      setClosingCuentaMesaId(null)
    }
  }, [tenantId, usuario?.id, fetchMesas])

  const handleUpdateExtraPrecio = useCallback(async (customizacionId: string, precioExtraGs: number) => {
    if (!selectedMesaId) return
    setUpdatingExtraPrecioId(customizacionId)
    try {
      await mesasService.updateItemCustomizacionExtraPrecio({
        tenantId,
        customizacionId,
        precioExtraGs,
      })
      setMesaFeedbackById(prev => ({
        ...prev,
        [selectedMesaId]: { type: 'success', message: `Extra actualizado a Gs. ${precioExtraGs.toLocaleString('es-PY')}.` },
      }))
      await fetchMesas(true)
    } catch (e: any) {
      setMesaFeedbackById(prev => ({
        ...prev,
        [selectedMesaId]: { type: 'error', message: e?.message ?? 'No se pudo actualizar el precio del extra.' },
      }))
    } finally {
      setUpdatingExtraPrecioId(null)
    }
  }, [tenantId, selectedMesaId, fetchMesas])

  const handleUpdateItemRecargo = useCallback(async (
    itemPedidoId: string,
    extraGs: number,
    options?: { mode?: 'line_total' | 'note_extra' }
  ) => {
    if (!selectedMesaId) return
    setUpdatingItemRecargoId(itemPedidoId)
    try {
      await mesasService.updateItemPedidoRecargo({
        tenantId,
        itemPedidoId,
        extraGs,
        mode: options?.mode,
      })
      setMesaFeedbackById(prev => ({
        ...prev,
        [selectedMesaId]: {
          type: 'success',
          message:
            options?.mode === 'note_extra'
              ? `Extra de nota actualizado a Gs. ${extraGs.toLocaleString('es-PY')}.`
              : `Precio actualizado a Gs. ${extraGs.toLocaleString('es-PY')}.`,
        },
      }))
      await fetchMesas(true)
    } catch (e: any) {
      setMesaFeedbackById(prev => ({
        ...prev,
        [selectedMesaId]: { type: 'error', message: e?.message ?? 'No se pudo actualizar el precio.' },
      }))
    } finally {
      setUpdatingItemRecargoId(null)
    }
  }, [tenantId, selectedMesaId, fetchMesas])

  const handleAddProductoManual = useCallback(async (nombre: string, precioGs: number) => {
    if (!selectedMesaId) return
    setAddingManualItemMesaId(selectedMesaId)
    try {
      await mesasService.addProductoManualEnMesa({
        tenantId,
        mesaId: selectedMesaId,
        nombre,
        precioGs,
      })
      setMesaFeedbackById(prev => ({
        ...prev,
        [selectedMesaId]: { type: 'success', message: `Producto agregado: ${nombre} (Gs. ${precioGs.toLocaleString('es-PY')}).` },
      }))
      await fetchMesas(true)
    } catch (e: any) {
      setMesaFeedbackById(prev => ({
        ...prev,
        [selectedMesaId]: { type: 'error', message: e?.message ?? 'No se pudo agregar el producto.' },
      }))
    } finally {
      setAddingManualItemMesaId(null)
    }
  }, [tenantId, selectedMesaId, fetchMesas])

  const handleReemplazarProductoCatalogo = useCallback(
    async (itemPedidoId: string, nuevoProductoId: string) => {
      if (!selectedMesaId) return
      try {
        await mesasService.reemplazarItemPedidoPorProductoCatalogo({
          tenantId,
          itemPedidoId,
          nuevoProductoId,
        })
        setMesaFeedbackById((prev) => ({
          ...prev,
          [selectedMesaId]: { type: 'success', message: 'Producto reemplazado; cocina reimpresa.' },
        }))
        await fetchMesas(true)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'No se pudo cambiar el producto.'
        setMesaFeedbackById((prev) => ({
          ...prev,
          [selectedMesaId]: { type: 'error', message: msg },
        }))
      }
    },
    [tenantId, selectedMesaId, fetchMesas]
  )

  const isBusy = navigatingTo !== null

  return (
    <div className={`h-full flex flex-col overflow-hidden ${darkMode ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className={`shrink-0 border-b ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}
        style={{
          paddingTop: '0.75rem',
          paddingBottom: '0.75rem',
          paddingLeft:  'max(1rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
        }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-orange-500 font-semibold">
                Panel de mesas
              </p>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-0.5 leading-tight">
                ¿A qué mesa vas?
              </h1>
            </div>

            <button
              type="button"
              onClick={() => void fetchMesas(true)}
              disabled={refreshing || isBusy}
              aria-label="Actualizar estado de mesas"
              className={`shrink-0 p-2.5 rounded-xl border transition ${
                darkMode
                  ? 'border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                  : 'border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600'
              } disabled:opacity-40`}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Stats pills */}
          {!loading && mesas.length > 0 && (
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              <StatPill count={resumen.libres}    label="libres"    dot="bg-emerald-500" text="text-emerald-800 dark:text-emerald-300" bg="bg-emerald-100 dark:bg-emerald-900/40" />
              <StatPill count={resumen.ocupadas}  label="ocupadas"  dot="bg-red-500"     text="text-red-800 dark:text-red-300"     bg="bg-red-100 dark:bg-red-900/40"     pulse={resumen.ocupadas > 0} />
              {resumen.reservadas > 0 && (
                <StatPill count={resumen.reservadas} label="reservadas" dot="bg-blue-500" text="text-blue-800 dark:text-blue-300" bg="bg-blue-100 dark:bg-blue-900/40" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Grid ───────────────────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{
          paddingTop: '1rem',
          paddingBottom: '1rem',
          paddingLeft:  'max(1rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
        }}
      >
        <div className="max-w-5xl mx-auto">

          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              <p className="text-sm text-gray-400">Cargando mesas…</p>
            </div>
          ) : mesas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 gap-3 text-center">
              <Table2 className="w-12 h-12 text-gray-300 dark:text-gray-700" />
              <p className="text-sm font-semibold text-gray-500">Sin mesas configuradas</p>
              <p className="text-xs text-gray-400 max-w-[220px] leading-relaxed">
                El admin puede crear las mesas desde el panel de gestión.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {mesas.map(mesa => {
                const isVirtualTakeaway = isVirtualTakeawayMesa(mesa)
                const isNavigating = navigatingTo === mesa.id
                const resumenMesa = resumenByMesa[mesa.id]
                const reservasMesa = reservasActivasPorMesa.get(mesa.id) ?? []
                const canTakeOrder = mesa.estado !== 'bloqueada'
                const cardBorder = isVirtualTakeaway
                  ? (darkMode ? 'border-amber-500' : 'border-amber-400')
                  : ESTADO_BORDER[mesa.estado]
                const cardBg = isVirtualTakeaway
                  ? (darkMode ? 'bg-amber-950/20' : 'bg-amber-50/90')
                  : ESTADO_CARD_BG[mesa.estado]
                const estadoBadge = isVirtualTakeaway
                  ? 'bg-amber-500 text-white border-amber-500 dark:bg-amber-500 dark:border-amber-500'
                  : ESTADO_BADGE[mesa.estado]
                const headerEyebrow = isVirtualTakeaway ? 'Para llevar' : 'Mesa'
                const headerTitle = isVirtualTakeaway ? 'Para llevar' : `#${mesa.numero}`

                return (
                  <article
                    key={mesa.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedMesaId(mesa.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedMesaId(mesa.id)
                      }
                    }}
                    className={`relative rounded-3xl border-[3px] p-4 shadow-sm flex flex-col gap-3 transition-colors cursor-pointer ${cardBorder} ${cardBg} ${isBusy ? 'opacity-70 pointer-events-none' : ''}`}
                  >
                    {isNavigating && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/70 dark:bg-gray-900/70 backdrop-blur-[2px] z-10">
                        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500">{headerEyebrow}</p>
                        <h3 className="text-3xl font-black leading-none mt-0.5">{headerTitle}</h3>
                      </div>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoBadge}`}>
                        {ESTADO_LABEL[mesa.estado]}
                      </span>
                    </div>

                    {mesa.estado === 'ocupada' && (
                      <div className="rounded-lg border border-red-200/70 dark:border-red-900/40 px-2.5 py-1.5 text-[11px] text-red-700 dark:text-red-300">
                        {loadingResumen && !resumenMesa
                          ? 'Cargando resumen...'
                          : resumenMesa
                            ? `${resumenMesa.total_items} items · Gs. ${resumenMesa.total_acumulado.toLocaleString('es-PY')}`
                            : 'Pedido activo sin resumen'}
                      </div>
                    )}

                    {reservasMesa.length > 0 && (
                      <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/20 px-2.5 py-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-0.5">
                          Próximas reservas
                        </p>
                        {reservasMesa.slice(0, 2).map(r => (
                          <p key={r.id} className="text-[11px] text-blue-700 dark:text-blue-300 truncate">
                            {r.nombre_reserva} · {new Date(r.inicio_at).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 mt-auto">
                      <button
                        type="button"
                        disabled={!canTakeOrder || isBusy}
                        onClick={(event) => {
                          event.stopPropagation()
                          handleSelect(mesa.id)
                        }}
                        className="rounded-xl bg-gray-900 dark:bg-gray-700 text-white text-xs font-semibold px-2.5 py-2 hover:opacity-90 transition disabled:opacity-40"
                      >
                        Tomar pedido
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setSelectedMesaId(mesa.id)
                        }}
                        className="rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold px-2.5 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition inline-flex items-center justify-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Ver detalle
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Footer: sin mesa ───────────────────────────────────────────────── */}
      <div
        className={`shrink-0 border-t ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}
        style={{
          paddingTop: '0.75rem',
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
          paddingLeft:  'max(1rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
        }}
      >
        <div className="max-w-5xl mx-auto">
          <button
            type="button"
            onClick={onSinMesa}
            disabled={isBusy}
            className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-sm font-semibold border transition ${
              darkMode
                ? 'border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            } disabled:opacity-40 active:scale-[0.98]`}
          >
            <ShoppingBag className="w-4 h-4 shrink-0" />
            Continuar sin mesa · Llevar / Delivery
          </button>
        </div>
      </div>

      <MesaPedidoCocinaToastHost darkMode={darkMode} />

      <DetalleMesaModal
        tenantId={tenantId}
        mesa={selectedMesa}
        reservasMesa={selectedMesa ? (reservasActivasPorMesa.get(selectedMesa.id) ?? []) : []}
        resumenPedido={selectedMesa ? (resumenByMesa[selectedMesa.id] ?? null) : null}
        loadingResumen={loadingResumen}
        isClosingMesa={selectedMesa ? closingCuentaMesaId === selectedMesa.id : false}
        feedback={selectedMesa ? (mesaFeedbackById[selectedMesa.id] ?? null) : null}
        onClose={() => setSelectedMesaId(null)}
        onTomarPedido={handleSelect}
        onCerrarCuenta={handleCerrarCuentaMesa}
        onUpdateExtraPrecio={handleUpdateExtraPrecio}
        updatingExtraId={updatingExtraPrecioId}
        onUpdateItemRecargo={handleUpdateItemRecargo}
        updatingItemId={updatingItemRecargoId}
        onAddProductoManual={handleAddProductoManual}
        addingProductoManual={selectedMesaId ? addingManualItemMesaId === selectedMesaId : false}
        onReemplazarProductoCatalogo={handleReemplazarProductoCatalogo}
        showOperationalActions={false}
        showSplitActions={false}
      />

    </div>
  )
}

// ─── Auxiliar ─────────────────────────────────────────────────────────────────

function StatPill({ count, label, dot, text, bg, pulse }: {
  count: number; label: string; dot: string; text: string; bg: string; pulse?: boolean
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${bg} px-3 py-1 rounded-full`}>
      <span className={`relative flex w-2.5 h-2.5 shrink-0`}>
        {pulse && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${dot}`} />}
        <span className={`relative inline-flex w-2.5 h-2.5 rounded-full ${dot}`} />
      </span>
      <span className={`text-sm font-black leading-none ${text}`}>{count}</span>
      <span className={`text-[11px] font-semibold leading-none ${text}`}>{label}</span>
    </span>
  )
}
