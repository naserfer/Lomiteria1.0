'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, Table2, RefreshCw, ArrowRight,
  Lock, CircleDot, CheckCircle2, CalendarClock, ShoppingBag,
} from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
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
    border:    'border-emerald-300 dark:border-emerald-700',
    bg:        'bg-white dark:bg-gray-900/80',
    hover:     'hover:border-emerald-400 hover:shadow-emerald-100 dark:hover:shadow-emerald-900/30 active:scale-[0.97]',
    badge:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    number:    'text-gray-900 dark:text-white',
    label:     'Libre',
    cta:       'Tomar pedido',
    ctaColor:  'text-emerald-600 dark:text-emerald-400',
    Icon:      CheckCircle2,
    iconColor: 'text-emerald-500',
    tappable:  true,
  },
  ocupada: {
    border:    'border-orange-300 dark:border-orange-700',
    bg:        'bg-white dark:bg-gray-900/80',
    hover:     'hover:border-orange-400 hover:shadow-orange-100 dark:hover:shadow-orange-900/30 active:scale-[0.97]',
    badge:     'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    number:    'text-gray-900 dark:text-white',
    label:     'Ocupada',
    cta:       'Agregar al pedido',
    ctaColor:  'text-orange-600 dark:text-orange-400',
    Icon:      CircleDot,
    iconColor: 'text-orange-500',
    tappable:  true,
  },
  reservada: {
    border:    'border-blue-300 dark:border-blue-700',
    bg:        'bg-white dark:bg-gray-900/80',
    hover:     'hover:border-blue-400 hover:shadow-blue-100 dark:hover:shadow-blue-900/30 active:scale-[0.97]',
    badge:     'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    number:    'text-gray-900 dark:text-white',
    label:     'Reservada',
    cta:       'Tomar pedido',
    ctaColor:  'text-blue-600 dark:text-blue-400',
    Icon:      CalendarClock,
    iconColor: 'text-blue-500',
    tappable:  true,
  },
  bloqueada: {
    border:    'border-gray-200 dark:border-gray-800',
    bg:        'bg-gray-50 dark:bg-gray-900/40',
    hover:     '',
    badge:     'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600',
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

  const [mesas,        setMesas]        = useState<Mesa[]>([])
  const [loading,      setLoading]      = useState(true)
  const [refreshing,   setRefreshing]   = useState(false)
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null)

  const fetchMesas = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const data = await mesasService.listMesas(tenantId)
      setMesas(data)
    } catch {
      // silent — grid stays with stale data on refresh errors
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [tenantId])

  useEffect(() => { void fetchMesas() }, [fetchMesas])

  const resumen = useMemo(() => ({
    libres:    mesas.filter(m => m.estado === 'libre').length,
    ocupadas:  mesas.filter(m => m.estado === 'ocupada').length,
    reservadas:mesas.filter(m => m.estado === 'reservada').length,
  }), [mesas])

  const handleSelect = (mesaId: string) => {
    if (navigatingTo) return
    setNavigatingTo(mesaId)
    router.push(`${ROUTES.PROTECTED.POS}?mesaId=${mesaId}`)
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
              <StatPill count={resumen.libres}    label="libres"    dot="bg-emerald-400" text="text-emerald-600 dark:text-emerald-400" />
              <StatPill count={resumen.ocupadas}  label="ocupadas"  dot="bg-orange-400"  text="text-orange-600 dark:text-orange-400" />
              {resumen.reservadas > 0 && (
                <StatPill count={resumen.reservadas} label="reservadas" dot="bg-blue-400" text="text-blue-600 dark:text-blue-400" />
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
                      'relative rounded-2xl border-2 p-4 flex flex-col gap-0 text-left',
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

function StatPill({ count, label, dot, text }: { count: number; label: string; dot: string; text: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${text}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
      {count} {label}
    </span>
  )
}
