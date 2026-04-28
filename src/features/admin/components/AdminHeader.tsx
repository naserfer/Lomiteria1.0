/**
 * Admin Module - Header Component
 * Encabezado principal del dashboard con resumen diario
 */

'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { BarChart3, PlusCircle, Users, ChefHat, ArrowDownCircle, Package, List, Loader2, Sun, Wallet, Droplets, History, Tag, Table2 } from 'lucide-react'
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
  onOpenMesasModal?: () => void
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
  onOpenMesasModal,
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

      {/* Acciones: dos sub-secciones con jerarquía clara */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50 overflow-hidden">

        {/* ── Navegar a ── */}
        <div className="px-4 pt-4 pb-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2.5">
            Navegar a
          </p>
          <div className="grid grid-cols-3 gap-2">

            {/* POS */}
            <button
              type="button"
              onClick={() => handleNav(ROUTES.PROTECTED.POS)}
              disabled={isNavigating}
              aria-busy={isNavTo(ROUTES.PROTECTED.POS)}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-xl px-2 py-3 sm:px-4 sm:py-2.5 w-full text-xs sm:text-sm font-semibold text-white transition disabled:opacity-60 disabled:cursor-not-allowed ${isNavTo(ROUTES.PROTECTED.POS) ? 'bg-gray-700 dark:bg-gray-600' : 'bg-gray-900 dark:bg-gray-800 hover:bg-gray-700 dark:hover:bg-gray-700'}`}
            >
              {isNavTo(ROUTES.PROTECTED.POS)
                ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden />
                : <BarChart3 className="w-4 h-4 shrink-0" />}
              <span className="leading-tight text-center sm:text-left">Ir al POS</span>
            </button>

            {/* Cocina 3D */}
            {(() => {
              const href = `${ROUTES.PROTECTED.COCINA}?from=${ROUTES.COCINA_FROM.ADMIN}`
              return (
                <button
                  type="button"
                  onClick={() => handleNav(href)}
                  disabled={isNavigating}
                  aria-busy={isNavTo(href)}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-xl px-2 py-3 sm:px-4 sm:py-2.5 w-full text-xs sm:text-sm font-semibold text-white transition disabled:opacity-60 disabled:cursor-not-allowed ${isNavTo(href) ? 'bg-orange-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                >
                  {isNavTo(href)
                    ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden />
                    : <ChefHat className="w-4 h-4 shrink-0" />}
                  <span className="leading-tight text-center sm:text-left">Cocina 3D</span>
                </button>
              )
            })()}

            {/* Clientes */}
            {(() => {
              const href = `${ROUTES.PROTECTED.CLIENTES}?from=${ROUTES.CLIENTES_FROM.ADMIN}`
              return (
                <button
                  type="button"
                  onClick={() => handleNav(href)}
                  disabled={isNavigating}
                  aria-busy={isNavTo(href)}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-xl px-2 py-3 sm:px-4 sm:py-2.5 w-full text-xs sm:text-sm font-semibold text-white transition disabled:opacity-60 disabled:cursor-not-allowed ${isNavTo(href) ? 'bg-purple-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                >
                  {isNavTo(href)
                    ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden />
                    : <Users className="w-4 h-4 shrink-0" />}
                  <span className="leading-tight text-center sm:text-left">Clientes</span>
                </button>
              )
            })()}
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 border-t border-gray-200 dark:border-gray-700" />

        {/* ── Acciones rápidas ── */}
        <div className="px-4 pt-3 pb-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2.5">
            Acciones rápidas
          </p>
          {/*
            flex-wrap + justify-center: cuando la última fila queda incompleta,
            los botones huérfanos se centran automáticamente.
            Cada botón tiene ancho fijo calculado para que entren exactamente
            2 / 3 / 4 por fila según el breakpoint (gap-2 = 0.5rem).
          */}
          <div className="flex flex-wrap justify-center gap-2">

            {/* Cargar stock */}
            <button
              type="button"
              onClick={onOpenStockDrawer}
              disabled={isNavigating}
              className="flex-none w-[calc(50%-0.25rem)] sm:w-[calc(33.333%-0.334rem)] lg:w-[calc(25%-0.375rem)] flex items-center gap-2 rounded-xl border border-orange-500/80 bg-orange-50 dark:bg-orange-950/20 px-3 py-2.5 text-xs sm:text-sm font-semibold text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition disabled:opacity-60 disabled:cursor-not-allowed min-w-0"
            >
              <ArrowDownCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">Cargar stock</span>
            </button>

            {/* Ver productos */}
            {onOpenProductosList && (
              <button
                type="button"
                onClick={onOpenProductosList}
                disabled={isNavigating}
                className="flex-none w-[calc(50%-0.25rem)] sm:w-[calc(33.333%-0.334rem)] lg:w-[calc(25%-0.375rem)] flex items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-60 disabled:cursor-not-allowed min-w-0"
              >
                <List className="w-4 h-4 shrink-0" />
                <span className="truncate">Ver productos</span>
              </button>
            )}

            {/* Categorías */}
            {onOpenCategoriaModal && (
              <button
                type="button"
                onClick={onOpenCategoriaModal}
                disabled={isNavigating}
                className="flex-none w-[calc(50%-0.25rem)] sm:w-[calc(33.333%-0.334rem)] lg:w-[calc(25%-0.375rem)] flex items-center gap-2 rounded-xl border border-sky-400 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/40 px-3 py-2.5 text-xs sm:text-sm font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition disabled:opacity-60 disabled:cursor-not-allowed min-w-0"
              >
                <Tag className="w-4 h-4 shrink-0" />
                <span className="truncate">Categorías</span>
              </button>
            )}

            {/* Mesas */}
            {onOpenMesasModal && (
              <button
                type="button"
                onClick={onOpenMesasModal}
                disabled={isNavigating}
                className="flex-none w-[calc(50%-0.25rem)] sm:w-[calc(33.333%-0.334rem)] lg:w-[calc(25%-0.375rem)] flex items-center gap-2 rounded-xl border border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-3 py-2.5 text-xs sm:text-sm font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition disabled:opacity-60 disabled:cursor-not-allowed min-w-0"
              >
                <Table2 className="w-4 h-4 shrink-0" />
                <span className="truncate">Mesas</span>
              </button>
            )}

            {/* Nuevo producto */}
            {onOpenProductModal && (
              <button
                type="button"
                onClick={onOpenProductModal}
                disabled={isNavigating}
                className="flex-none w-[calc(50%-0.25rem)] sm:w-[calc(33.333%-0.334rem)] lg:w-[calc(25%-0.375rem)] flex items-center gap-2 rounded-xl border border-violet-400 dark:border-violet-600 bg-violet-50 dark:bg-violet-950/40 px-3 py-2.5 text-xs sm:text-sm font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/50 transition disabled:opacity-60 disabled:cursor-not-allowed min-w-0"
              >
                <Package className="w-4 h-4 shrink-0" />
                <span className="truncate">Nuevo producto</span>
              </button>
            )}

            {/* Salsas */}
            {onOpenSalsasDrawer && (
              <button
                type="button"
                onClick={onOpenSalsasDrawer}
                disabled={isNavigating}
                className="flex-none w-[calc(50%-0.25rem)] sm:w-[calc(33.333%-0.334rem)] lg:w-[calc(25%-0.375rem)] flex items-center gap-2 rounded-xl border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 px-3 py-2.5 text-xs sm:text-sm font-semibold text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40 transition disabled:opacity-60 disabled:cursor-not-allowed min-w-0"
              >
                <Droplets className="w-4 h-4 shrink-0" />
                <span className="truncate">Salsas</span>
              </button>
            )}

            {/* Registrar materia prima */}
            <button
              type="button"
              onClick={onOpenIngredienteModal}
              disabled={isNavigating}
              className="flex-none w-[calc(50%-0.25rem)] sm:w-[calc(33.333%-0.334rem)] lg:w-[calc(25%-0.375rem)] flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-orange-600 transition disabled:opacity-60 disabled:cursor-not-allowed min-w-0"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">
                <span className="sm:hidden">Materia prima</span>
                <span className="hidden sm:inline">Registrar materia prima</span>
              </span>
            </button>

          </div>
        </div>
      </div>
    </section>
  )
}
