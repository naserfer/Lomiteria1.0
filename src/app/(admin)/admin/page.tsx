'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Loader2,
  TrendingUp,
  Package2,
  Users2,
  Coins,
  Warehouse,
  AlertTriangle,
  PlusCircle,
  BarChart3,
  Activity,
  Droplet,
  ShieldCheck,
  Package,
  Percent
} from 'lucide-react'
import { supabase } from '@/core/supabase'
import { useTenant } from '@/features/auth/TenantContext'
import { formatGuaranies, formatNumber } from '@/shared/utils/format'
import { KpiCard } from '@/features/dashboard/components/KpiCard'
import { InventoryDrawer } from '@/features/inventario/components/InventoryDrawer'
import { getIngredientEstimationFromItems } from '@/features/inventario/consumption.service'

interface PedidoRecord {
  id: string
  total: number
  created_at: string
  tipo: 'local' | 'delivery' | 'para_llevar'
  puntos_generados: number | null
}

interface InventoryRecord {
  id: string
  stock_actual: number
  stock_minimo: number
  unidad: string
  controlar_stock: boolean
  productos?: {
    nombre?: string | null
  } | null
}

interface ClientRanking {
  id: string
  nombre: string
  telefono: string | null
  puntos_totales: number
  total_pedidos: number
  total_gastado: number
}

interface ProductRanking {
  producto_id: string | null
  producto_nombre: string
  unidades: number
  ingresos: number
  costo_estimado: number
  margen_estimado: number
}

interface IngredientUsage {
  slug: string
  label: string
  unit: string
  total: number
}

const buildWeekLabels = () => {
  const labels: { label: string; date: string }[] = []
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(now.getDate() - i)
    date.setHours(0, 0, 0, 0)
    labels.push({
      label: date.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase(),
      date: date.toISOString()
    })
  }
  return labels
}

const normalizeNumber = (value: number | null | undefined) => Number(value ?? 0)
const ESTIMATED_COST_RATIO = 0.48
const estimateCostFromAmount = (value: number) =>
  Math.round(normalizeNumber(value) * ESTIMATED_COST_RATIO)

export default function AdminPage() {
  const { tenant, usuario, darkMode } = useTenant()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    todayOrders: 0,
    todayRevenue: 0,
    todayCost: 0,
    todayProfit: 0,
    monthRevenue: 0,
    monthCost: 0,
    monthProfit: 0,
    avgTicket: 0,
    itemsPerOrder: 0,
    loyaltyRate: 0,
    activeClients: 0,
    loyaltyPoints: 0,
    weeklyTrend: buildWeekLabels().map((item) => ({ label: item.label, value: 0 })),
    channelSplit: {
      local: 0,
      delivery: 0,
      para_llevar: 0
    }
  })
  const [topClients, setTopClients] = useState<ClientRanking[]>([])
  const [topProducts, setTopProducts] = useState<ProductRanking[]>([])
  const [inventory, setInventory] = useState<InventoryRecord[]>([])
  const [ingredientsUsage, setIngredientsUsage] = useState<IngredientUsage[]>([])
  const [showInventoryDrawer, setShowInventoryDrawer] = useState(false)

  const fetchDashboard = useCallback(async () => {
    if (!tenant) return
    setLoading(true)

    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - 6)
    weekStart.setHours(0, 0, 0, 0)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    try {
      const [pedidosRes, clientesRes, topClientsRes, inventoryRes, itemsRes] = await Promise.all([
        supabase
          .from('pedidos')
          .select('id,total,created_at,tipo,puntos_generados')
          .eq('tenant_id', tenant.id)
          .gte('created_at', monthStart.toISOString()),
        supabase
          .from('clientes')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id),
        supabase
          .from('vista_top_clientes')
          .select('*')
          .eq('tenant_id', tenant.id)
          .limit(5),
        supabase
          .from('inventario')
          .select(
            'id,stock_actual,stock_minimo,unidad,controlar_stock,productos:producto_id(nombre,categoria:categorias(nombre))'
          )
          .eq('tenant_id', tenant.id),
        supabase
          .from('items_pedido')
          .select(
            'cantidad,subtotal,producto_id,producto_nombre,pedidos!inner(tenant_id,created_at)'
          )
          .eq('pedidos.tenant_id', tenant.id)
          .gte('pedidos.created_at', monthStart.toISOString())
      ])

      const pedidos = (pedidosRes.data as PedidoRecord[]) ?? []
      const todayOrders = pedidos.filter((pedido) => new Date(pedido.created_at) >= todayStart)
      const todayRevenue = todayOrders.reduce(
        (acc, pedido) => acc + normalizeNumber(pedido.total),
        0
      )
      const avgTicket = todayOrders.length > 0 ? Math.round(todayRevenue / todayOrders.length) : 0
      const monthRevenue = pedidos.reduce(
        (acc, pedido) => acc + normalizeNumber(pedido.total),
        0
      )

      const weeklyLabels = buildWeekLabels()
      const weeklyTrend = weeklyLabels.map((slot) => {
        const value = pedidos
          .filter(
            (pedido) =>
              new Date(pedido.created_at).toLocaleDateString() ===
              new Date(slot.date).toLocaleDateString()
          )
          .reduce((sum, pedido) => sum + normalizeNumber(pedido.total), 0)
        return {
          label: slot.label,
          value
        }
      })

      const channelSplit = { local: 0, delivery: 0, para_llevar: 0 }
      pedidos.forEach((pedido) => {
        const tipo = pedido.tipo
        channelSplit[tipo] = (channelSplit[tipo as keyof typeof channelSplit] ?? 0) + 1
      })

      const loyaltyPoints = pedidos.reduce(
        (sum, pedido) => sum + normalizeNumber(pedido.puntos_generados),
        0
      )

      setTopClients((topClientsRes.data as ClientRanking[]) ?? [])

      const inventoryRawData = inventoryRes.data ?? []
      const inventoryData: InventoryRecord[] = inventoryRawData.map((item) => {
        // Supabase devuelve productos como un array en este caso
        const productosArray = item.productos as unknown as Array<{ nombre?: string | null }> | null
        const productosNombre = productosArray && productosArray.length > 0 ? productosArray[0].nombre : null
        
        const record: InventoryRecord = {
          id: String(item.id),
          stock_actual: normalizeNumber(item.stock_actual),
          stock_minimo: normalizeNumber(item.stock_minimo),
          unidad: String(item.unidad),
          controlar_stock: Boolean(item.controlar_stock),
          productos: productosNombre ? { nombre: productosNombre } : null
        }
        return record
      })

      setInventory(inventoryData ?? [])

      const items = (itemsRes.data as any[]) ?? []
      const todayItems = items.filter((item) => {
        const createdAt = item.pedidos?.created_at
        if (!createdAt) return false
        return new Date(createdAt) >= todayStart
      })
      const productTotals = new Map<string, ProductRanking>()

      items.forEach((item) => {
        const key = item.producto_id || item.producto_nombre
        const existing = productTotals.get(key) ?? {
          producto_id: item.producto_id,
          producto_nombre: item.producto_nombre,
          unidades: 0,
          ingresos: 0,
          costo_estimado: 0,
          margen_estimado: 0
        }

        const lineRevenue = normalizeNumber(item.subtotal)
        const lineCost = estimateCostFromAmount(lineRevenue)

        existing.unidades += item.cantidad ?? 0
        existing.ingresos += lineRevenue
        existing.costo_estimado += lineCost
        existing.margen_estimado = existing.ingresos - existing.costo_estimado
        productTotals.set(key, existing)
      })

      setTopProducts(
        Array.from(productTotals.values())
          .sort((a, b) => b.unidades - a.unidades)
          .slice(0, 5)
      )

      const totalItemsCount = items.reduce((sum, item) => sum + (item.cantidad ?? 0), 0)
      const itemsPerOrder = pedidos.length ? totalItemsCount / pedidos.length : 0

      const loyaltyOrders = pedidos.filter((pedido) => normalizeNumber(pedido.puntos_generados) > 0).length
      const loyaltyRate = pedidos.length ? loyaltyOrders / pedidos.length : 0

      const estimatedMonthCost = items.reduce(
        (sum, item) => sum + estimateCostFromAmount(item.subtotal),
        0
      )
      const estimatedTodayCost = todayItems.reduce(
        (sum, item) => sum + estimateCostFromAmount(item.subtotal),
        0
      )
      const todayProfit = todayRevenue - estimatedTodayCost
      const monthProfit = monthRevenue - estimatedMonthCost

      const usageEstimate = await getIngredientEstimationFromItems(tenant.id, todayItems)
      setIngredientsUsage(usageEstimate)

      setStats({
        todayOrders: todayOrders.length,
        todayRevenue,
        todayCost: estimatedTodayCost,
        todayProfit,
        monthRevenue,
        monthCost: estimatedMonthCost,
        monthProfit,
        avgTicket,
        itemsPerOrder,
        loyaltyRate,
        activeClients: clientesRes.count ?? 0,
        loyaltyPoints,
        weeklyTrend,
        channelSplit
      })
    } catch (error) {
      console.error('Error cargando dashboard:', error)
    } finally {
      setLoading(false)
    }
  }, [tenant])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  const lowStockItems = useMemo(
    () => inventory.filter((item) => item.stock_actual <= item.stock_minimo),
    [inventory]
  )

  const totalInventoryItems = inventory.length

  if (!tenant) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
          <p className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-700'}`}>
            Preparando tu panel inteligente...
          </p>
        </div>
      </div>
    )
  }

  const todayLabel = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date())

  return (
    <>
      <section className="rounded-3xl border border-white/40 dark:border-gray-900 bg-white/80 dark:bg-gray-900/70 backdrop-blur p-6 shadow-lg shadow-black/5 space-y-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
              Resumen diario • {todayLabel}
            </p>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight">
              Operación integral de {tenant.nombre}
            </h1>
            <p className="text-gray-500 dark:text-gray-300">
              Ka&apos;u Manager centraliza ventas, inventario, clientes y caja en un único panel.
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
          <div className="flex flex-wrap gap-3">
            <Link
              href="/pos"
              className="inline-flex items-center gap-2 rounded-2xl bg-gray-900 text-white px-5 py-3 font-semibold hover:bg-gray-800 transition"
            >
              <BarChart3 className="w-5 h-5" />
              Abrir POS
            </Link>
            <button
              onClick={() => setShowInventoryDrawer(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 font-semibold text-white shadow-xl shadow-orange-500/40 hover:bg-orange-600 transition"
            >
              <PlusCircle className="w-5 h-5" />
              Registrar inventario
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <KpiCard
            title="Ventas de hoy"
            value={formatGuaranies(stats.todayRevenue)}
            subtitle={`${stats.todayOrders} pedidos • Ticket prom. ${formatGuaranies(stats.avgTicket)}`}
            accent="orange"
          />
          <KpiCard
            title="Ganancia estimada"
            value={formatGuaranies(stats.todayProfit)}
            subtitle={`Costo aprox. ${formatGuaranies(stats.todayCost)}`}
            accent="purple"
          >
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <Coins className="w-4 h-4 text-purple-500" />
              Ratio aplicado: {(ESTIMATED_COST_RATIO * 100).toFixed(0)}% del precio
            </div>
          </KpiCard>
          <KpiCard
            title="Clientes activos"
            value={formatNumber(stats.activeClients)}
            subtitle="+ Fidelización en tiempo real"
            accent="green"
          >
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-green-500" /> Puntos emitidos: {formatNumber(stats.loyaltyPoints)}
            </div>
          </KpiCard>
          <KpiCard
            title="Stock monitoreado"
            value={`${totalInventoryItems - lowStockItems.length}/${totalInventoryItems}`}
            subtitle={`${lowStockItems.length} insumos con alertas`}
            accent="blue"
          />
        </div>
      </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="rounded-3xl border border-white/40 dark:border-gray-800 bg-white/80 dark:bg-gray-900/70 backdrop-blur p-6 shadow-lg shadow-black/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-orange-500">Cierre de caja</p>
                <h2 className="text-2xl font-bold">Resumen diario</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Usa estos números como base antes de contar efectivo.
                </p>
              </div>
              <TrendingUp className="w-6 h-6 text-orange-500" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              <div className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
                <p className="text-xs text-gray-500 uppercase">Cobrado hoy</p>
                <p className="text-xl font-bold">{formatGuaranies(stats.todayRevenue)}</p>
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
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-gray-500">
                * Costos calculados automáticamente con recetas y un ratio estándar. Podrás ajustarlos cuando
                carguemos los costos reales.
              </p>
              <button className="rounded-2xl bg-gray-900 text-white px-4 py-2 text-sm font-semibold hover:bg-gray-800 transition">
                Iniciar cierre de caja
              </button>
            </div>
          </div>
          <div className="rounded-3xl border border-white/40 dark:border-gray-800 bg-gradient-to-br from-gray-900 to-gray-800 text-white p-6 shadow-xl shadow-black/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">Ka&apos;u Manager</p>
                <h2 className="text-2xl font-bold">Balance del mes</h2>
                <p className="text-sm text-white/70">Controlá margen y costos acumulados.</p>
              </div>
              <Activity className="w-6 h-6 text-white/70" />
            </div>
            <div className="grid grid-cols-1 gap-4 mt-6">
              <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
                <p className="text-xs uppercase text-white/60">Ingresos del mes</p>
                <p className="text-2xl font-bold">{formatGuaranies(stats.monthRevenue)}</p>
              </div>
              <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
                <p className="text-xs uppercase text-white/60">Costo estimado del mes</p>
                <p className="text-2xl font-bold">{formatGuaranies(stats.monthCost)}</p>
              </div>
              <div className="rounded-2xl bg-white text-gray-900 p-4">
                <p className="text-xs uppercase text-gray-500">Ganancia estimada</p>
                <p className="text-2xl font-bold text-emerald-600">{formatGuaranies(stats.monthProfit)}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <KpiCard
            title="Ingresos del mes"
            value={formatGuaranies(stats.monthRevenue)}
            subtitle="Incluye delivery + salón + take-away"
            accent="green"
          >
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <Coins className="w-4 h-4 text-green-500" />
              Costo: {formatGuaranies(stats.monthCost)} • Ganancia: {formatGuaranies(stats.monthProfit)}
            </div>
          </KpiCard>
          <KpiCard
            title="Items por pedido"
            value={stats.itemsPerOrder.toFixed(1)}
            subtitle="Promedio de productos por ticket"
            accent="purple"
          >
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <Package className="w-4 h-4 text-purple-500" />
              Tickets más grandes = mayor margen
            </div>
          </KpiCard>
          <KpiCard
            title="Clientes fidelizados"
            value={`${Math.round(stats.loyaltyRate * 100)}%`}
            subtitle="Pedidos con puntos acumulados"
            accent="blue"
          >
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <Percent className="w-4 h-4 text-blue-500" />
              Puntos emitidos: {formatNumber(stats.loyaltyPoints)}
            </div>
          </KpiCard>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
          <div className="xl:col-span-2 rounded-3xl border border-white/40 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 backdrop-blur shadow-lg shadow-black/5 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-orange-500">últimos 7 días</p>
                <h2 className="text-2xl font-bold">Tendencia de ingresos</h2>
              </div>
              <TrendingUp className="w-6 h-6 text-orange-500" />
            </div>
            <div className="grid grid-cols-7 gap-3 min-h-[160px]">
              {stats.weeklyTrend.map((day) => (
                <div key={day.label} className="flex flex-col items-center gap-2">
                  <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-2xl h-28 relative overflow-hidden">
                    <div
                      className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-orange-500 to-orange-300"
                      style={{ height: `${Math.min(100, day.value / 500000 * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs font-semibold text-gray-500">{day.label}</p>
                  <p className="text-[11px] text-gray-400">{formatNumber(day.value)}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-4 text-sm">
              {(['local', 'delivery', 'para_llevar'] as const).map((channel) => (
                <div
                  key={channel}
                  className="flex-1 min-w-[120px] rounded-2xl border border-gray-100 dark:border-gray-800 px-4 py-3"
                >
                  <p className="text-xs text-gray-500 uppercase">{channel}</p>
                  <p className="text-lg font-bold">{stats.channelSplit[channel]}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-white/40 dark:border-gray-800 bg-gradient-to-br from-gray-900 to-gray-800 text-white p-6 shadow-xl shadow-black/30">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-green-300">Inventario crítico</p>
                <h2 className="text-2xl font-bold">Alertas inmediatas</h2>
              </div>
              <Warehouse className="w-7 h-7 text-green-300" />
            </div>
            <div className="space-y-4">
              {lowStockItems.slice(0, 4).map((item) => (
                <div key={item.id} className="p-4 rounded-2xl bg-white/10 border border-white/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{item.productos?.nombre ?? 'Insumo sin nombre'}</p>
                      <p className="text-xs text-white/60">{item.unidad} • mínimo {item.stock_minimo}</p>
                    </div>
                    <AlertTriangle className="w-5 h-5 text-yellow-300" />
                  </div>
                  <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-500 to-orange-400"
                      style={{
                        width: `${Math.min(
                          100,
                          (item.stock_actual / Math.max(item.stock_minimo || 1, 1)) * 100
                        )}%`
                      }}
                    />
                  </div>
                </div>
              ))}
              {lowStockItems.length === 0 && (
                <p className="text-sm text-white/60 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> Todo el inventario está por encima del mínimo.
                </p>
              )}
            </div>
            <button
              onClick={() => setShowInventoryDrawer(true)}
              className="mt-6 w-full rounded-2xl bg-white text-gray-900 font-semibold py-3 hover:bg-orange-50 transition"
            >
              Registrar movimiento
            </button>
          </div>
        </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-3xl border border-white/60 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 backdrop-blur p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Users2 className="w-5 h-5 text-orange-500" />
                Top clientes
              </h3>
              <span className="text-xs text-gray-500">Últimos 30 días</span>
            </div>
            <div className="space-y-4">
              {topClients.map((client) => (
                <div key={client.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{client.nombre}</p>
                    <p className="text-xs text-gray-500">Pedidos: {client.total_pedidos}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatGuaranies(client.total_gastado)}</p>
                    <p className="text-xs text-orange-500">{client.puntos_totales} pts</p>
                  </div>
                </div>
              ))}
              {!topClients.length && (
                <p className="text-sm text-gray-500">Aún no hay clientes con compras registradas.</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/60 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 backdrop-blur p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Package2 className="w-5 h-5 text-orange-500" />
                Productos estrella
              </h3>
              <BarChart3 className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-4">
              {topProducts.map((product) => (
                <div key={product.producto_id ?? product.producto_nombre} className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{product.producto_nombre}</p>
                    <p className="text-xs text-gray-500">
                      {product.unidades} unidades · Costo {formatGuaranies(product.costo_estimado)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatGuaranies(product.ingresos)}</p>
                    <p className="text-xs text-emerald-500">
                      Margen {formatGuaranies(product.margen_estimado)}
                    </p>
                  </div>
                </div>
              ))}
              {!topProducts.length && (
                <p className="text-sm text-gray-500">Aún no hay ventas registradas.</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/60 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 backdrop-blur p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Droplet className="w-5 h-5 text-orange-500" />
                Consumo estimado
              </h3>
              <Activity className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-3">
              {ingredientsUsage.slice(0, 5).map((ingredient) => (
                <div key={ingredient.slug}>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{ingredient.label}</p>
                    <p className="text-sm text-gray-500">
                      {ingredient.total.toFixed(ingredient.unit === 'unidad' ? 0 : 1)} {ingredient.unit}
                    </p>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 to-orange-300"
                      style={{ width: '75%' }}
                    />
                  </div>
                </div>
              ))}
              {!ingredientsUsage.length && (
                <p className="text-sm text-gray-500">
                  Todavía no hay suficientes pedidos para calcular el consumo de insumos.
                </p>
              )}
            </div>
          </div>
        </section>

      <section className="rounded-3xl border border-white/60 dark:border-gray-800 bg-white/80 dark:bg-gray-900/60 backdrop-blur p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                Inventario detallado
              </p>
              <h3 className="text-2xl font-bold">Insumos controlados</h3>
            </div>
            <div className="flex gap-3">
              <Link
                href="/admin/productos"
                className="rounded-2xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold hover:border-orange-400 transition"
              >
                Gestionar productos
              </Link>
              <button
                onClick={() => setShowInventoryDrawer(true)}
                className="rounded-2xl bg-gray-900 text-white px-4 py-2 text-sm font-semibold hover:bg-gray-800 transition"
              >
                Nuevo movimiento
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inventory.map((item) => {
              const progress = Math.min(
                100,
                (item.stock_actual / Math.max(item.stock_minimo || 1, 1)) * 100
              )
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4 bg-white/60 dark:bg-gray-900/40"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{item.productos?.nombre ?? 'Insumo sin nombre'}</p>
                      <p className="text-xs text-gray-500">
                        Min {item.stock_minimo} {item.unidad}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        item.controlar_stock
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {item.controlar_stock ? 'Auto' : 'Manual'}
                    </span>
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-bold">
                        {item.stock_actual.toLocaleString()} {item.unidad}
                      </span>
                      <span className="text-gray-500">{progress.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div
                        className={`h-full ${
                          progress < 30
                            ? 'bg-gradient-to-r from-red-500 to-orange-500'
                            : 'bg-gradient-to-r from-emerald-500 to-emerald-300'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
            {!inventory.length && (
              <div className="col-span-full text-sm text-gray-500">
                Aún no tienes insumos cargados en inventario. Usá el botón &quot;Nuevo movimiento&quot; para
                registrar el primero.
              </div>
            )}
          </div>
      </section>
      <InventoryDrawer
        open={showInventoryDrawer}
        onClose={() => setShowInventoryDrawer(false)}
        tenantId={tenant.id}
        usuarioId={usuario?.id ?? null}
        onSaved={() => {
          setShowInventoryDrawer(false)
          fetchDashboard()
        }}
      />
    </>
  )
}
