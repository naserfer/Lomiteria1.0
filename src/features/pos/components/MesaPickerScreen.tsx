'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, Table2, RefreshCw, ArrowRight,
  Lock, CircleDot, CheckCircle2, CalendarClock, ShoppingBag,
} from 'lucide-react'
import type { ResumenMesa } from '@/features/mesas/types/mesas.types'
import { useTenant } from '@/contexts/TenantContext'
import { createClient } from '@/lib/supabase/client'
import { mesasService } from '@/features/mesas/services/mesasService'
import { ROUTES } from '@/config/routes'
import type { EstadoMesa, Mesa } from '@/features/mesas/types/mesas.types'

// ─── Estilos por estado ───────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<EstadoMesa, {
  border: string
  bg: string
  hover: string
  badge: string
  number: string
  label: string
  cta: string
  ctaColor: string
  Icon: React.ElementType
  iconColor: string
  tappable: boolean
}> = {
  libre: {
    border:    'border-emerald-600 dark:border-emerald-500',
    bg:        'bg-emerald-50 dark:bg-emerald-950/30',
    hover:     'hover:border-emerald-600 hover:shadow-emerald-200 dark:hover:shadow-emerald-900/30 active:scale-[0.97]',
    badge:     'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white',
    number:    'text-emerald-700 dark:text-emerald-300',
    label:     'Libre',
    cta:       'Tomar pedido',
    ctaColor:  'text-emerald-700 dark:text-emerald-400',
    Icon:      CheckCircle2,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    tappable:  true,
  },
  ocupada: {
    border:    'border-red-600 dark:border-red-500',
    bg:        'bg-red-50 dark:bg-red-950/30',
    hover:     'hover:border-red-600 hover:shadow-red-200 dark:hover:shadow-red-900/30 active:scale-[0.97]',
    badge:     'bg-red-600 text-white dark:bg-red-500 dark:text-white',
    number:    'text-red-700 dark:text-red-300',
    label:     'Ocupada',
    cta:       'Agregar al pedido',
    ctaColor:  'text-red-700 dark:text-red-400',
    Icon:      CircleDot,
    iconColor: 'text-red-600 dark:text-red-400',
    tappable:  true,
  },
  reservada: {
    border:    'border-blue-600 dark:border-blue-500',
    bg:        'bg-blue-50 dark:bg-blue-950/30',
    hover:     'hover:border-blue-600 hover:shadow-blue-200 dark:hover:shadow-blue-900/30 active:scale-[0.97]',
    badge:     'bg-blue-600 text-white dark:bg-blue-500 dark:text-white',
    number:    'text-blue-700 dark:text-blue-300',
    label:     'Reservada',
    cta:       'Tomar pedido',
    ctaColor:  'text-blue-700 dark:text-blue-400',
    Icon:      CalendarClock,
    iconColor: 'text-blue-600 dark:text-blue-400',
    tappable:  true,
  },
  bloqueada: {
    border:    'border-gray-200 dark:border-gray-800',
    bg:        'bg-gray-50 dark:bg-gray-900/40',
    hover:     '',
    badge:     'bg-gray-400 text-white dark:bg-gray-700 dark:text-gray-400',
    number:    'text-gray-300 dark:text-gray-700',
    label:     'Bloqueada',
    cta:       '',
    ctaColor:  '',
    Icon:      Lock,
    iconColor: 'text-gray-300 dark:text-gray-700',
    tappable:  false,
  },
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface MesaPickerScreenProps {
  tenantId: string
  onSinMesa: () => void
}

export function MesaPickerScreen({ tenantId, onSinMesa }: MesaPickerScreenProps) {
  const router = useRouter()
  const { darkMode } = useTenant()

  const [mesas,          setMesas]          = useState<Mesa[]>([])
  const [loading,        setLoading]        = useState(true)
  const [refreshing,     setRefreshing]     = useState(false)
  const [navigatingTo,   setNavigatingTo]   = useState<string | null>(null)
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

  const handleSelect = (mesaId: string) => {
    if (navigatingTo) return
    setNavigatingTo(mesaId)
    router.push(`${ROUTES.PROTECTED.POS}?mesaId=${mesaId}&from=${ROUTES.POS_FROM.POS_PICKER}`)
  }

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
                const cfg          = ESTADO_CONFIG[mesa.estado]
                const isNavigating = navigatingTo === mesa.id

                return (
                  <button
                    key={mesa.id}
                    type="button"
                    disabled={!cfg.tappable || isBusy}
                    onClick={() => handleSelect(mesa.id)}
                    className={[
                      'relative rounded-2xl border-[3px] p-4 flex flex-col gap-0 text-left',
                      'transition-all duration-150 select-none touch-manipulation',
                      'shadow-sm',
                      cfg.border,
                      cfg.bg,
                      cfg.tappable && !isBusy
                        ? `cursor-pointer ${cfg.hover} hover:shadow-md`
                        : 'cursor-not-allowed opacity-40',
                      isNavigating
                        ? 'ring-2 ring-orange-500 ring-offset-2 dark:ring-offset-gray-950 scale-[0.97]'
                        : '',
                    ].join(' ')}
                    style={{ minHeight: 136 }}
                  >
                    {/* Overlay mientras navega */}
                    {isNavigating && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/70 dark:bg-gray-900/70 backdrop-blur-[2px] z-10">
                        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                      </div>
                    )}

                    {/* Fila superior: ícono de estado + badge */}
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <cfg.Icon className={`w-4 h-4 shrink-0 ${cfg.iconColor}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                    </div>

                    {/* Número de mesa — protagonista */}
                    <p className={`text-[2.5rem] font-black leading-none tracking-tight ${cfg.number}`}>
                      {mesa.numero}
                    </p>

                    {/* Alias */}
                    {mesa.nombre && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">
                        {mesa.nombre}
                      </p>
                    )}

                    {/* Capacidad */}
                    <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-1">
                      {mesa.capacidad} pax
                    </p>

                    {/* Resumen de pedido — solo ocupadas */}
                    {mesa.estado === 'ocupada' && (() => {
                      const resumen = resumenByMesa[mesa.id]
                      if (loadingResumen && !resumen) {
                        return (
                          <div className="mt-2 pt-2 border-t border-red-200/60 dark:border-red-900/30 animate-pulse space-y-1">
                            <div className="h-2.5 bg-red-100 dark:bg-red-900/30 rounded w-4/5" />
                            <div className="h-2.5 bg-red-100 dark:bg-red-900/30 rounded w-3/5" />
                            <div className="h-2.5 bg-red-200 dark:bg-red-900/40 rounded w-2/5 mt-1" />
                          </div>
                        )
                      }
                      if (!resumen) return null
                      return (
                        <div className="mt-2 pt-2 border-t border-red-200/60 dark:border-red-900/30 space-y-0.5">
                          {resumen.pedidos.flatMap(p => p.items).slice(0, 3).map(item => (
                            <p key={item.id} className="text-[10px] text-red-700 dark:text-red-300 leading-tight truncate">
                              <span className="font-bold">{item.cantidad}×</span> {item.producto_nombre}
                            </p>
                          ))}
                          {resumen.total_items > 3 && (
                            <p className="text-[10px] text-red-400 dark:text-red-500">
                              +{resumen.total_items - 3} más…
                            </p>
                          )}
                          <p className="text-[11px] font-black text-red-700 dark:text-red-300 pt-0.5 tabular-nums">
                            Gs.{resumen.total_acumulado.toLocaleString('es-PY')}
                          </p>
                        </div>
                      )
                    })()}

                    {/* CTA arrow — solo en mesas accionables */}
                    {cfg.tappable && !isNavigating && (
                      <div className={`flex items-center gap-0.5 mt-auto pt-2 text-[11px] font-semibold ${cfg.ctaColor}`}>
                        {cfg.cta}
                        <ArrowRight className="w-3 h-3" />
                      </div>
                    )}
                  </button>
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
