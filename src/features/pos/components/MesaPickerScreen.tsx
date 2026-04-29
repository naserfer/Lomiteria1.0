'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, Table2, RefreshCw, ShoppingBag, Eye,
} from 'lucide-react'
import type { ResumenMesa } from '@/features/mesas/types/mesas.types'
import { useTenant } from '@/contexts/TenantContext'
import { createClient } from '@/lib/supabase/client'
import { mesasService } from '@/features/mesas/services/mesasService'
import { cerrarCuentaMesaService } from '@/features/mesas/services/cerrarCuentaMesaService'
import { ROUTES } from '@/config/routes'
import type { EstadoMesa, Mesa } from '@/features/mesas/types/mesas.types'
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

// ─── Componente ───────────────────────────────────────────────────────────────

interface MesaPickerScreenProps {
  tenantId: string
  onSinMesa: () => void
}

export function MesaPickerScreen({ tenantId, onSinMesa }: MesaPickerScreenProps) {
  const router = useRouter()
  const { darkMode, usuario } = useTenant()

  const [mesas,          setMesas]          = useState<Mesa[]>([])
  const [loading,        setLoading]        = useState(true)
  const [refreshing,     setRefreshing]     = useState(false)
  const [navigatingTo,   setNavigatingTo]   = useState<string | null>(null)
  const [selectedMesaId, setSelectedMesaId] = useState<string | null>(null)
  const [closingCuentaMesaId, setClosingCuentaMesaId] = useState<string | null>(null)
  const [mesaFeedbackById, setMesaFeedbackById] = useState<Record<string, { type: 'success' | 'error'; message: string }>>({})
  const [resumenByMesa,  setResumenByMesa]  = useState<Record<string, ResumenMesa>>({})
  const [loadingResumen, setLoadingResumen] = useState(false)

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

  useEffect(() => { void fetchMesas() }, [fetchMesas])

  // ── Realtime ──────────────────────────────────────────────────────────────────

  const mesasRef = useRef(mesas)
  useEffect(() => { mesasRef.current = mesas }, [mesas])

  useEffect(() => {
    const supabase    = createClient()
    const debounceRef = { current: null as ReturnType<typeof setTimeout> | null }

    const refresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => void fetchResumenes(mesasRef.current), 600)
    }

    const channel = supabase
      .channel(`mesas-resumen-picker-${tenantId}`)
      .on('postgres_changes', { event: '*',      schema: 'public', table: 'pedidos',      filter: `tenant_id=eq.${tenantId}` }, refresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'items_pedido' }, refresh)
      .subscribe()

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      void supabase.removeChannel(channel)
    }
  }, [tenantId, fetchResumenes])

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
    } catch (e: any) {
      setMesaFeedbackById(prev => ({
        ...prev,
        [mesa.id]: { type: 'error', message: e?.message ?? 'No se pudo cerrar la cuenta de la mesa.' },
      }))
    } finally {
      setClosingCuentaMesaId(null)
    }
  }, [tenantId, usuario?.id, fetchMesas])

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
                const isNavigating = navigatingTo === mesa.id
                const resumenMesa = resumenByMesa[mesa.id]
                const canTakeOrder = mesa.estado !== 'bloqueada'

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
                    className={`relative rounded-3xl border-[3px] p-4 shadow-sm flex flex-col gap-3 transition-colors cursor-pointer ${ESTADO_BORDER[mesa.estado]} ${ESTADO_CARD_BG[mesa.estado]} ${isBusy ? 'opacity-70 pointer-events-none' : ''}`}
                  >
                    {isNavigating && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/70 dark:bg-gray-900/70 backdrop-blur-[2px] z-10">
                        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500">Mesa</p>
                        <h3 className="text-3xl font-black leading-none mt-0.5">#{mesa.numero}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 truncate">
                          {mesa.nombre?.trim() || 'Sin alias'} · {mesa.capacidad} pax
                        </p>
                      </div>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${ESTADO_BADGE[mesa.estado]}`}>
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

      <DetalleMesaModal
        mesa={selectedMesa}
        reservasMesa={[]}
        resumenPedido={selectedMesa ? (resumenByMesa[selectedMesa.id] ?? null) : null}
        loadingResumen={loadingResumen}
        isClosingMesa={selectedMesa ? closingCuentaMesaId === selectedMesa.id : false}
        feedback={selectedMesa ? (mesaFeedbackById[selectedMesa.id] ?? null) : null}
        onClose={() => setSelectedMesaId(null)}
        onTomarPedido={handleSelect}
        onCerrarCuenta={handleCerrarCuentaMesa}
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
