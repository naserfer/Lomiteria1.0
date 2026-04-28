/**
 * Admin Module - Main View Component
 * Componente principal del dashboard de administración
 */

'use client'

import { useState, useCallback, useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { IngredienteModal } from './IngredienteModal'
import { OwnerProductModal } from '@/features/owner/components/OwnerProductModal'
import { ProductosListModal } from './ProductosListModal'
import { useAdminDashboard } from '../hooks/useAdminDashboard'
import { useEstadoCaja } from '@/features/caja/hooks/useEstadoCaja'
import { CerrarCajaModal } from '@/features/caja/components/CerrarCajaModal'
import { abrirCajaAction } from '@/app/actions/caja'
import { resetCocinaDailyData } from '@/features/cocina/utils/achievements'
import { AdminHeader } from './AdminHeader'
import { AdminLoading } from './AdminLoading'
import { KpiCards } from './KpiCards'
import { DailySummary } from './DailySummary'
import { MonthlyBalance } from './MonthlyBalance'
import { AdditionalKpis } from './AdditionalKpis'
import { WeeklyTrend } from './WeeklyTrend'
import { InventoryAlerts } from './InventoryAlerts'
import { TopClients } from './TopClients'
import { TopProducts } from './TopProducts'
import { IngredientConsumption } from './IngredientConsumption'
import { ChannelPieChart } from './ChannelPieChart'
import { InventoryGrid } from './InventoryGrid'
import { InventoryDrawer } from './InventoryDrawer'
import { SalsasDrawer } from './SalsasDrawer'
import { CategoriaModal } from './CategoriaModal'
import { GestionMesasModal } from './GestionMesasModal'
import type { AdminDatePreset } from '../types/admin.types'
import { resolveAdminDateRange } from '../utils/date.utils'

export const AdminView = () => {
  const { tenant, usuario, darkMode } = useTenant()
  const [showIngredienteModal, setShowIngredienteModal] = useState(false)
  const [showOwnerProductModal, setShowOwnerProductModal] = useState(false)
  const [showProductosListModal, setShowProductosListModal] = useState(false)
  const [showStockDrawer, setShowStockDrawer] = useState(false)
  const [showCategoriaModal, setShowCategoriaModal] = useState(false)
  const [showMesasModal, setShowMesasModal] = useState(false)
  const [showSalsasDrawer, setShowSalsasDrawer] = useState(false)
  const [showCerrarCajaModal, setShowCerrarCajaModal] = useState(false)
  const [showConfirmEmpezar, setShowConfirmEmpezar] = useState(false)
  const [showConfirmCerrar, setShowConfirmCerrar] = useState(false)
  const [isEmpezando, setIsEmpezando] = useState(false)
  const [errorEmpezar, setErrorEmpezar] = useState<string | null>(null)
  const [selectedPreset, setSelectedPreset] = useState<AdminDatePreset>('turno_actual')

  const { sesionAbierta, ultimaSesionCerrada, loading: loadingCaja, refetch: refetchCaja } = useEstadoCaja(tenant?.id ?? null)

  const handleEmpezarDia = useCallback(async () => {
    if (!tenant?.id) return { success: false as const, error: 'Tenant no disponible.' }
    return await abrirCajaAction(tenant.id)
  }, [tenant?.id])

  const onConfirmEmpezar = useCallback(async () => {
    setErrorEmpezar(null)
    setIsEmpezando(true)
    const result = await handleEmpezarDia()
    setIsEmpezando(false)
    if (result.success) {
      if (tenant?.id) resetCocinaDailyData(tenant.id)
      await refetchCaja()
      setShowConfirmEmpezar(false)
    } else {
      setErrorEmpezar(result.error)
    }
  }, [handleEmpezarDia, refetchCaja, tenant?.id])

  const onConfirmCerrarCaja = useCallback(async () => {
    setShowConfirmCerrar(false)
    setShowCerrarCajaModal(true)
  }, [])

  // Admin puede crear productos a partir de materias primas (recetas, combos, sin receta)
  const canManageProducts = usuario?.rol === 'admin'
  const isAdmin = usuario?.rol === 'admin'

  const dateRange = useMemo(
    () =>
      resolveAdminDateRange(selectedPreset, {
        turnStartAt: sesionAbierta?.apertura_at ?? null,
        lastClosedTurn:
          selectedPreset === 'turno_actual' && !sesionAbierta && ultimaSesionCerrada?.cierre_at
            ? {
                apertura_at: ultimaSesionCerrada.apertura_at,
                cierre_at: ultimaSesionCerrada.cierre_at
              }
            : null
      }),
    [selectedPreset, sesionAbierta, ultimaSesionCerrada?.apertura_at, ultimaSesionCerrada?.cierre_at]
  )

  const {
    loading,
    refreshing,
    stats,
    topClients,
    topProducts,
    inventory,
    ingredientsUsage,
    lowStockItems,
    totalInventoryItems,
    refetch
  } = useAdminDashboard(tenant?.id ?? null, { dateRange })

  // Si no hay tenant, mostrar loader
  if (!tenant) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      </div>
    )
  }

  // Turno: esperar estado de caja para acotar al último cierre; si no, el primer fetch usa "hoy" vacío
  if (loading || (selectedPreset === 'turno_actual' && loadingCaja)) {
    return <AdminLoading darkMode={darkMode} />
  }

  const handleIngredienteSaved = () => {
    setShowIngredienteModal(false)
    refetch()
  }

  const handleOwnerProductSaved = () => {
    setShowOwnerProductModal(false)
    refetch()
  }

  const handleStockDrawerSaved = () => {
    setShowStockDrawer(false)
    refetch()
  }

  const handleCategoriaSaved = () => {
    setShowCategoriaModal(false)
    refetch()
  }

  const handleMesasSaved = () => {
    setShowMesasModal(false)
    refetch()
  }

  const handleSalsasSaved = () => {
    setShowSalsasDrawer(false)
    refetch()
  }

  const displayStats =
    selectedPreset === 'turno_actual' && !sesionAbierta && ultimaSesionCerrada
      ? {
          ...stats,
          todayOrders: ultimaSesionCerrada.cantidad_pedidos,
          todayRevenue: ultimaSesionCerrada.total_ventas,
          todayCost: ultimaSesionCerrada.total_costo_estimado,
          todayProfit: ultimaSesionCerrada.ganancia_neta,
          avgTicket: ultimaSesionCerrada.cantidad_pedidos
            ? Math.round(ultimaSesionCerrada.total_ventas / ultimaSesionCerrada.cantidad_pedidos)
            : 0
        }
      : stats

  const datosUltimoTurno =
    selectedPreset === 'turno_actual' && !sesionAbierta && !!ultimaSesionCerrada

  const resumenLabel =
    selectedPreset === 'turno_actual' && sesionAbierta
      ? `Turno actual (desde ${new Date(sesionAbierta.apertura_at).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })})`
      : selectedPreset === 'turno_actual' && ultimaSesionCerrada?.cierre_at
        ? `Datos del último turno · cierre ${new Date(ultimaSesionCerrada.cierre_at).toLocaleString('es-PY', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}`
        : dateRange.label

  return (
    <>
      {/* Header con resumen del turno actual o último cierre */}
      <AdminHeader
        tenantName={tenant.nombre}
        stats={displayStats}
        resumenLabel={resumenLabel}
        datosUltimoTurno={datosUltimoTurno}
        onOpenIngredienteModal={() => setShowIngredienteModal(true)}
        onOpenStockDrawer={() => setShowStockDrawer(true)}
        onOpenCategoriaModal={() => setShowCategoriaModal(true)}
        onOpenMesasModal={() => setShowMesasModal(true)}
        onOpenSalsasDrawer={canManageProducts ? () => setShowSalsasDrawer(true) : undefined}
        onOpenProductosList={canManageProducts ? () => setShowProductosListModal(true) : undefined}
        onOpenProductModal={canManageProducts ? () => setShowOwnerProductModal(true) : undefined}
        sesionAbierta={sesionAbierta}
        loadingCaja={loadingCaja}
        onEmpezarDia={() => setShowConfirmEmpezar(true)}
        onAbrirModalCerrarCaja={() => setShowConfirmCerrar(true)}
        selectedPreset={selectedPreset}
        onPresetChange={setSelectedPreset}
      />

      {/* KPI Cards principales (mismo criterio: turno actual o último cierre) */}
      <KpiCards
        stats={displayStats}
        totalInventoryItems={totalInventoryItems}
        lowStockCount={lowStockItems.length}
        periodLabel={dateRange.label}
        datosUltimoTurno={datosUltimoTurno}
        animationKey={selectedPreset}
        darkMode={darkMode}
      />

      {/* Resumen diario y balance mensual */}
      {/* <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <DailySummary stats={stats} />
        <MonthlyBalance stats={stats} />
      </section> */}

      {/* KPIs adicionales */}
      {/* <AdditionalKpis stats={stats} /> */}

      {/* Tendencia semanal y alertas de inventario */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start">
        <WeeklyTrend
          stats={displayStats}
          animationKey={selectedPreset}
          selectedPreset={selectedPreset}
          onPresetChange={setSelectedPreset}
          isRefreshing={refreshing}
          darkMode={darkMode}
          datosUltimoTurno={datosUltimoTurno}
        />
        <InventoryAlerts
          lowStockItems={lowStockItems}
          inventory={inventory}
          tenantNombre={tenant.nombre ?? ''}
          onOpenStockDrawer={() => setShowStockDrawer(true)}
        />
      </section>

      {/* Distribución por canal + Top clientes, productos y consumo */}
      <section className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="rounded-3xl border border-white/60 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 backdrop-blur p-6">
          <h3 className={`text-lg font-bold ${datosUltimoTurno ? 'mb-1' : 'mb-4'}`}>Distribución por canal</h3>
          {datosUltimoTurno && (
            <p className="mb-3 text-[11px] font-medium text-amber-800 dark:text-amber-400/95">
              Pedidos del último turno cerrado
            </p>
          )}
          <ChannelPieChart channelSplit={displayStats.channelSplit} animationKey={selectedPreset} />
        </div>
        <TopClients topClients={topClients} periodLabel={dateRange.label} datosUltimoTurno={datosUltimoTurno} />
        <TopProducts topProducts={topProducts} />
        <IngredientConsumption ingredientsUsage={ingredientsUsage} />
      </section>

      {/* Grid completo de inventario */}
      <InventoryGrid
        inventory={inventory}
        totalInventoryItems={totalInventoryItems}
        lowStockCount={lowStockItems.length}
        onOpenIngredienteModal={() => setShowIngredienteModal(true)}
        onOpenStockDrawer={() => setShowStockDrawer(true)}
        onOpenProductModal={canManageProducts ? () => setShowOwnerProductModal(true) : undefined}
      />

      {/* Modal para registrar nuevos ingredientes */}
      <IngredienteModal
        open={showIngredienteModal}
        onClose={() => setShowIngredienteModal(false)}
        tenantId={tenant.id}
        onSaved={handleIngredienteSaved}
      />

      {/* Modal para ver listado de productos (editar, eliminar, enlace a nuevo) */}
      <ProductosListModal
        open={showProductosListModal}
        onClose={() => setShowProductosListModal(false)}
        tenantId={tenant.id}
        onOpenCreate={() => setShowOwnerProductModal(true)}
        onRefresh={refetch}
      />

      {/* Modal para crear productos (recetas, combos, sin receta) — mismo que en gestión owner */}
      <OwnerProductModal
        open={showOwnerProductModal}
        onClose={() => setShowOwnerProductModal(false)}
        tenantId={tenant.id}
        onSaved={handleOwnerProductSaved}
      />

      {/* Drawer para cargar stock de materias primas existentes */}
      <InventoryDrawer
        open={showStockDrawer}
        onClose={() => setShowStockDrawer(false)}
        tenantId={tenant.id}
        usuarioId={usuario?.id ?? null}
        onSaved={handleStockDrawerSaved}
      />

      {/* Drawer para crear salsas por vasitos (productos + receta de 1 ingrediente) */}
      <SalsasDrawer
        open={showSalsasDrawer}
        onClose={() => setShowSalsasDrawer(false)}
        tenantId={tenant.id}
        onSaved={handleSalsasSaved}
      />

      <CategoriaModal
        open={showCategoriaModal}
        onClose={() => setShowCategoriaModal(false)}
        tenantId={tenant.id}
        onSaved={handleCategoriaSaved}
      />

      <GestionMesasModal
        open={showMesasModal}
        onClose={() => setShowMesasModal(false)}
        tenantId={tenant.id}
        onSaved={handleMesasSaved}
        canDelete={isAdmin}
        usuarioId={usuario?.id ?? null}
      />

      {/* Confirmación: Empezar el día */}
      <ConfirmModal
        open={showConfirmEmpezar}
        onClose={() => { setShowConfirmEmpezar(false); setErrorEmpezar(null) }}
        title="¿Empezar el día?"
        message="Se habilitarán POS y Cocina para operar. El resumen de ingresos y ganancias se calculará desde este momento."
        errorMessage={errorEmpezar}
        confirmLabel="Sí, empezar el día"
        cancelLabel="Cancelar"
        onConfirm={onConfirmEmpezar}
        variant="primary"
        loading={isEmpezando}
        darkMode={darkMode}
      />

      {/* Confirmación: Cerrar caja */}
      <ConfirmModal
        open={showConfirmCerrar}
        onClose={() => setShowConfirmCerrar(false)}
        title="¿Cerrar la caja?"
        message="Se calcularán los totales del turno y deberás ingresar el monto pagado a empleados. Esta acción registra el cierre del día."
        confirmLabel="Sí, cerrar caja"
        cancelLabel="Cancelar"
        onConfirm={onConfirmCerrarCaja}
        variant="warning"
        darkMode={darkMode}
      />

      {/* Modal cerrar caja (solo cuando hay sesión abierta) */}
      {sesionAbierta && (
        <CerrarCajaModal
          open={showCerrarCajaModal}
          onClose={() => setShowCerrarCajaModal(false)}
          sesion={sesionAbierta}
          tenantId={tenant.id}
          tenantNombre={tenant.nombre}
          onCerrarExitoso={refetchCaja}
          darkMode={darkMode}
        />
      )}
    </>
  )
}
