/**
 * Admin Module - Header Component
 * Encabezado principal del dashboard con resumen diario
 */

'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { BarChart3, PlusCircle, Users, ChefHat, ArrowDownCircle, Package, List, Loader2, Sun, Wallet, Droplets, History, Tag } from 'lucide-react'
import { DatePresetPills } from './DatePresetPills'
import { formatGuaranies } from '@/lib/utils/format'
import { ROUTES } from '@/config/routes'
import { getTodayLabel } from '../utils/admin.utils'
import type { DashboardStats } from '../types/admin.types'
import type { AdminDatePreset } from '../types/admin.types'
import type { SesionCaja } from '@/features/caja/types/caja.types'

interface AdminHeaderProps {
  tenantName: string
  stats: DashboardStats
  /** Ej. "Turno actual (desde 08:00)" o "Datos del último turno · …" */
  resumenLabel?: string
  /** Sin caja abierta: el panel refleja el último turno cerrado */
  datosUltimoTurno?: boolean
  onOpenIngredienteModal: () => void
  onOpenStockDrawer: () => void
  onOpenCategoriaModal?: () => void
  onOpenSalsasDrawer?: () => void
  onOpenProductModal?: () => void
  onOpenProductosList?: () => void
  /** Estado de caja: null = cerrada, objeto = abierta */
  sesionAbierta: SesionCaja | null
  loadingCaja: boolean
  onEmpezarDia: () => void
  onAbrirModalCerrarCaja: () => void
  selectedPreset: AdminDatePreset
  onPresetChange: (preset: AdminDatePreset) => void
}

function formatHora (iso: string) {
  return new Date(iso).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })
}

export const AdminHeader = ({
  tenantName,
  stats,
  resumenLabel,
  datosUltimoTurno = false,
  onOpenIngredienteModal,
  onOpenStockDrawer,
  onOpenCategoriaModal,
  onOpenSalsasDrawer,
  onOpenProductModal,
  onOpenProductosList,
  sesionAbierta,
  loadingCaja,
  onEmpezarDia,
  onAbrirModalCerrarCaja,
  selectedPreset,
  onPresetChange
}: AdminHeaderProps) => {
  const router = useRouter()
  const [loadingHref, setLoadingHref] = useState<string | null>(null)
  const label = resumenLabel ?? `Resumen diario • ${getTodayLabel()}`

  const handleEmpezarDia = useCallback(() => {
    onEmpezarDia()
  }, [onEmpezarDia])

  const handleNav = useCallback((href: string) => {
    if (loadingHref) return
    setLoadingHref(href)
    router.push(href)
  }, [router, loadingHref])

  const isNavigating = loadingHref !== null
  const isNavTo = (href: string) => loadingHref === href

  return (
    <section className="rounded-3xl border border-white/40 dark:border-gray-900 bg-white/80 dark:bg-gray-900/70 backdrop-blur p-6 shadow-lg shadow-black/5 space-y-6">
      {/* Bloque: Operación integral (solo título y KPIs) */}
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
          {label}
        </p>
        <h1 className="text-3xl lg:text-4xl font-black tracking-tight">
          Operación integral de {tenantName}
        </h1>
        <p className="text-gray-500 dark:text-gray-300">
          KarúBox centraliza ventas, inventario, clientes y caja en un único panel.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
            <p className="text-xs text-gray-500 uppercase">Ingresos</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {formatGuaranies(stats.todayRevenue)}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
            <p className="text-xs text-gray-500 uppercase">Costo estimado</p>
            <p className="text-xl font-bold text-purple-600 dark:text-purple-300">
              {formatGuaranies(stats.todayCost)}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
            <p className="text-xs text-gray-500 uppercase">Ganancia estimada</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-300">
              {formatGuaranies(stats.todayProfit)}
            </p>
          </div>
        </div>
      </div>

      {/* Selector de período con pills animados */}
      <DatePresetPills
        selected={selectedPreset}
        onChange={onPresetChange}
        disabled={isNavigating}
      />

      {datosUltimoTurno && (
        <div
          className="flex gap-3 rounded-2xl border border-amber-300/90 bg-amber-50/95 px-4 py-3 text-sm text-amber-950 dark:border-amber-600/50 dark:bg-amber-950/35 dark:text-amber-100"
          role="status"
        >
          <History className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
          <p className="leading-snug">
            <span className="font-semibold">Estás viendo datos del último turno cerrado.</span>{' '}
            No hay turno abierto: los totales y gráficos corresponden a ese cierre hasta que pulses{' '}
            <span className="font-medium">Empezar el día</span>.
          </p>
        </div>
      )}

      {/* Estado de caja */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
          Caja
        </p>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          {loadingCaja ? (
            <span className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Verificando estado…
            </span>
          ) : sesionAbierta ? (
            <>
              <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1.5">
                <Sun className="w-4 h-4" />
                Caja abierta desde {formatHora(sesionAbierta.apertura_at)}
              </span>
              <button
                type="button"
                onClick={onAbrirModalCerrarCaja}
                disabled={isNavigating}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-orange-500 bg-orange-50 dark:bg-orange-950/30 px-4 py-2.5 text-sm font-semibold text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40 transition disabled:opacity-60"
              >
                <Wallet className="w-4 h-4 shrink-0" />
                Cerrar caja
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Iniciá el día para habilitar POS y Cocina.
              </p>
              <button
                type="button"
                onClick={handleEmpezarDia}
                disabled={isNavigating}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 dark:bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 dark:hover:bg-emerald-600 transition disabled:opacity-60"
              >
                <Sun className="w-4 h-4 shrink-0" />
                Empezar el día
              </button>
            </>
          )}
        </div>
      </div>

      {/* Barra única de acciones: todos los botones en un solo bloque */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
          Acciones
        </p>
        <div className="flex flex-wrap gap-3">
          {/* 1. Principal: Ir al POS */}
          <button
            type="button"
            onClick={() => handleNav(ROUTES.PROTECTED.POS)}
            disabled={isNavigating}
            className={`
              inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition min-w-[7rem]
              ${isNavigating ? 'cursor-not-allowed' : 'hover:opacity-90'}
              disabled:opacity-60 disabled:cursor-not-allowed
              ${isNavTo(ROUTES.PROTECTED.POS)
                ? 'bg-gray-800 dark:bg-gray-700 text-white'
                : 'bg-gray-900 dark:bg-gray-800 text-white'}
            `}
            aria-busy={isNavTo(ROUTES.PROTECTED.POS)}
          >
            {isNavTo(ROUTES.PROTECTED.POS) ? (
              <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <BarChart3 className="w-4 h-4 shrink-0" />
            )}
            Ir al POS
          </button>

          {/* 2. Navegación: Cocina 3D (from=admin para breadcrumb) */}
          {(() => {
            const cocinaHref = `${ROUTES.PROTECTED.COCINA}?from=${ROUTES.COCINA_FROM.ADMIN}`
            return (
          <button
            type="button"
            onClick={() => handleNav(cocinaHref)}
            disabled={isNavigating}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-orange-600 dark:bg-orange-600 transition min-w-[7rem] disabled:opacity-60 disabled:cursor-not-allowed ${isNavigating ? 'cursor-not-allowed' : 'hover:bg-orange-700 dark:hover:bg-orange-500'}`}
            aria-busy={isNavTo(cocinaHref)}
          >
            {isNavTo(cocinaHref) ? (
              <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <ChefHat className="w-4 h-4 shrink-0" />
            )}
            Cocina 3D
          </button>
            )
          })()}

          {/* 3. Navegación: Clientes (from=admin para breadcrumb) */}
          {(() => {
            const clientesHref = `${ROUTES.PROTECTED.CLIENTES}?from=${ROUTES.CLIENTES_FROM.ADMIN}`
            return (
          <button
            type="button"
            onClick={() => handleNav(clientesHref)}
            disabled={isNavigating}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-purple-600 transition min-w-[7rem] disabled:opacity-60 disabled:cursor-not-allowed ${isNavigating ? 'cursor-not-allowed' : 'hover:opacity-90'}`}
            aria-busy={isNavTo(clientesHref)}
          >
            {isNavTo(clientesHref) ? (
              <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Users className="w-4 h-4 shrink-0" />
            )}
            Clientes
          </button>
            )
          })()}

          {/* Separador visual: acciones en página */}
          <span className="w-px self-stretch bg-gray-200 dark:bg-gray-600 hidden sm:block" aria-hidden />

          {/* 4. Cargar stock */}
          <button
            type="button"
            onClick={onOpenStockDrawer}
            disabled={isNavigating}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-orange-500/80 bg-orange-50 dark:bg-orange-950/20 px-4 py-2.5 text-sm font-semibold text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <ArrowDownCircle className="w-4 h-4 shrink-0" />
            Cargar stock
          </button>

          {/* 5. Ver productos */}
          {onOpenProductosList && (
            <button
              type="button"
              onClick={onOpenProductosList}
              disabled={isNavigating}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <List className="w-4 h-4 shrink-0" />
              Ver productos
            </button>
          )}

          {/* 6. Categorías */}
          {onOpenCategoriaModal && (
            <button
              type="button"
              onClick={onOpenCategoriaModal}
              disabled={isNavigating}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-400 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/40 px-4 py-2.5 text-sm font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Tag className="w-4 h-4 shrink-0" />
              Categorías
            </button>
          )}

          {/* 7. Nuevo producto */}
          {onOpenProductModal && (
            <button
              type="button"
              onClick={onOpenProductModal}
              disabled={isNavigating}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-400 dark:border-violet-600 bg-violet-50 dark:bg-violet-950/40 px-4 py-2.5 text-sm font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/50 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Package className="w-4 h-4 shrink-0" />
              Nuevo producto
            </button>
          )}

          {/* 7.1 Salsas por vasitos */}
          {onOpenSalsasDrawer && (
            <button
              type="button"
              onClick={onOpenSalsasDrawer}
              disabled={isNavigating}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 px-4 py-2.5 text-sm font-semibold text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Droplets className="w-4 h-4 shrink-0" />
              Salsas
            </button>
          )}

          {/* 8. Registrar materia prima — CTA secundario */}
          <button
            type="button"
            onClick={onOpenIngredienteModal}
            disabled={isNavigating}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            Registrar materia prima
          </button>
        </div>
      </div>
    </section>
  )
}
