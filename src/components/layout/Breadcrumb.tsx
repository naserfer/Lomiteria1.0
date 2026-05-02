'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ChevronRight,
  Home,
  Users,
  ShoppingCart,
  LayoutDashboard,
  ChefHat,
  Store,
  ShoppingBag,
  PlusCircle,
  Package,
  UserCog,
  Building2,
  FileText,
  Settings,
  Loader2,
  Table2,
  BarChart3,
} from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { ROUTES, posHrefWithMesaPhase } from '@/config/routes'

interface BreadcrumbItem {
  label: string
  path: string
  icon?: ReactNode
}

const NAV_TIMEOUT_MS = 12_000

export function Breadcrumb() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { darkMode, isAdmin, tenant, hasMesas, usuario } = useTenant()
  /** `path` o `href` exacto del botón pulsado (mientras Next navega) */
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null)

  // Mesa seleccionada en el POS (cargamos el número una sola vez por cambio de mesaId)
  const mesaId = searchParams.get('mesaId')
  const [mesaNumero, setMesaNumero] = useState<number | null>(null)

  useEffect(() => {
    if (!mesaId || !tenant?.id) { setMesaNumero(null); return }
    let cancelled = false
    createClient()
      .from('mesas')
      .select('numero')
      .eq('tenant_id', tenant.id)
      .eq('id', mesaId)
      .single()
      .then(({ data }) => { if (!cancelled && data?.numero) setMesaNumero(data.numero) })
    return () => { cancelled = true }
  }, [mesaId, tenant?.id])

  const items: BreadcrumbItem[] = []

  if (pathname.startsWith('/owner')) {
    // Home siempre es el primer item para el rol owner
    items.push({
      label: 'Home',
      path: ROUTES.PROTECTED.OWNER,
      icon: <Home className="w-4 h-4" />,
    })

    if (pathname === '/owner/caja') {
      items.push({
        label: 'Caja de socios',
        path: '/owner/caja',
        icon: <FileText className="w-4 h-4" />,
      })
    } else if (pathname === ROUTES.PROTECTED.OWNER_ANALYTICS) {
      items.push({
        label: 'Analytics Landing',
        path: ROUTES.PROTECTED.OWNER_ANALYTICS,
        icon: <BarChart3 className="w-4 h-4" />,
      })
    } else if (pathname === '/owner/tenants') {
      items.push({
        label: 'Lomiterías',
        path: '/owner/tenants',
        icon: <Store className="w-4 h-4" />,
      })
    } else if (pathname === '/owner/tenants/new') {
      items.push({
        label: 'Crear lomitería',
        path: '/owner/tenants/new',
        icon: <PlusCircle className="w-4 h-4" />,
      })
    } else if (pathname.match(/^\/owner\/tenants\/[^/]+$/) && !pathname.endsWith('/new')) {
      const tenantName = searchParams.get('name')
      items.push({
        label: tenantName ?? 'Detalle del negocio',
        path: pathname,
        icon: <Building2 className="w-4 h-4" />,
      })
    } else if (pathname.includes('/owner/tenants/') && pathname.endsWith('/productos')) {
      const tenantName = searchParams.get('name')
      items.push({
        label: tenantName ?? 'Gestionar productos',
        path: pathname,
        icon: tenantName ? <Store className="w-4 h-4" /> : <Package className="w-4 h-4" />,
      })
    } else if (pathname.includes('/owner/tenants/') && pathname.endsWith('/cajeros')) {
      // Extraer tenantId para construir la ruta hacia productos
      const match = pathname.match(/\/owner\/tenants\/([^/]+)\/cajeros/)
      const tenantId = match?.[1]
      const tenantName = searchParams.get('name')
      if (tenantId) {
        items.push({
          label: tenantName ?? 'Gestionar productos',
          path: `/owner/tenants/${tenantId}/productos${tenantName ? `?name=${encodeURIComponent(tenantName)}` : ''}`,
          icon: <Store className="w-4 h-4" />,
        })
      }
      items.push({
        label: 'Usuarios',
        path: pathname,
        icon: <UserCog className="w-4 h-4" />,
      })
    }
  } else {
    // Rutas /home: "Inicio" solo si es admin
    if (isAdmin) {
      items.push({
        label: 'Inicio',
        path: ROUTES.PROTECTED.HOME,
        icon: <Home className="w-4 h-4" />,
      })
    }

    if (pathname.startsWith('/home/configuracion')) {
      items.push({
        label: 'Configuración del negocio',
        path: ROUTES.PROTECTED.CONFIGURACION,
        icon: <Settings className="w-4 h-4" />,
      })
    } else if (pathname.startsWith('/home/admin/cocina')) {
      const fromCocina = searchParams.get('from')
      if (fromCocina === ROUTES.COCINA_FROM.HOME) {
        items.push({
          label: 'Cocina 3D',
          path: `${ROUTES.PROTECTED.COCINA}?from=${ROUTES.COCINA_FROM.HOME}`,
          icon: <ChefHat className="w-4 h-4" />,
        })
      } else {
        items.push({
          label: 'Administración',
          path: ROUTES.PROTECTED.ADMIN,
          icon: <LayoutDashboard className="w-4 h-4" />,
        })
        items.push({
          label: 'Cocina 3D',
          path: `${ROUTES.PROTECTED.COCINA}?from=${ROUTES.COCINA_FROM.ADMIN}`,
          icon: <ChefHat className="w-4 h-4" />,
        })
      }
    } else if (pathname.startsWith('/home/admin')) {
      const fromClientes = searchParams.get('from')

      if (pathname === '/home/admin/clientes') {
        // Clientes: desde Home (Inicio → Clientes) o desde Admin / sin param (Inicio → Administración → Clientes)
        if (fromClientes === ROUTES.CLIENTES_FROM.HOME) {
          items.push({
            label: 'Clientes',
            path: `${ROUTES.PROTECTED.CLIENTES}?from=${ROUTES.CLIENTES_FROM.HOME}`,
            icon: <Users className="w-4 h-4" />,
          })
        } else {
          items.push({
            label: 'Administración',
            path: ROUTES.PROTECTED.ADMIN,
            icon: <LayoutDashboard className="w-4 h-4" />,
          })
          items.push({
            label: 'Clientes',
            path: `${ROUTES.PROTECTED.CLIENTES}?from=${ROUTES.CLIENTES_FROM.ADMIN}`,
            icon: <Users className="w-4 h-4" />,
          })
        }
      } else {
        items.push({
          label: 'Administración',
          path: '/home/admin',
          icon: <LayoutDashboard className="w-4 h-4" />,
        })
      }
    } else if (pathname.startsWith('/home/pos')) {
      const mesaPhaseParam = searchParams.get('mesaPhase')
      const isPosPickerRole =
        usuario?.rol === 'admin' || usuario?.rol === 'cajero'

      const posParentHref =
        hasMesas && isPosPickerRole
          ? posHrefWithMesaPhase(ROUTES.POS_MESA_PHASE.PICKER)
          : ROUTES.PROTECTED.POS

      items.push({
        label: 'Punto de Venta',
        path: posParentHref,
        icon: <ShoppingCart className="w-4 h-4" />,
      })

      // En el mesa picker (`mesaPhase=picker`): solo "Punto de Venta" como paso actual.
      // Tras elegir mesa: "Punto de Venta" (enlace al picker) + "Mesa #N".
      const showSinMesaCrumb =
        hasMesas &&
        isPosPickerRole &&
        !mesaId &&
        mesaPhaseParam === ROUTES.POS_MESA_PHASE.SIN_MESA

      if (showSinMesaCrumb) {
        items.push({
          label: 'Sin mesa',
          path: posHrefWithMesaPhase(ROUTES.POS_MESA_PHASE.SIN_MESA),
          icon: <ShoppingBag className="w-4 h-4" />,
        })
      }

      if (mesaId) {
        const fromQ = searchParams.get('from')
        const mesaHref = `${ROUTES.PROTECTED.POS}?mesaId=${encodeURIComponent(mesaId)}${fromQ ? `&from=${encodeURIComponent(fromQ)}` : ''}`
        items.push({
          label: mesaNumero !== null ? `Mesa #${mesaNumero}` : 'Mesa',
          path: mesaHref,
          icon: <Table2 className="w-4 h-4" />,
        })
      }
    } else if (pathname.startsWith('/home/mesas')) {
      items.push({
        label: 'Mesas',
        path: ROUTES.PROTECTED.MESAS,
        icon: <Table2 className="w-4 h-4" />,
      })
    } else if (pathname.startsWith('/home/pedidos')) {
      const fromPedidos = searchParams.get('from')
      if (fromPedidos === ROUTES.PEDIDOS_FROM.POS) {
        items.push({
          label: 'Punto de Venta',
          path: `${ROUTES.PROTECTED.POS}`,
          icon: <ShoppingCart className="w-4 h-4" />,
        })
      }
      items.push({
        label: 'Historial de pedidos',
        path: `${ROUTES.PROTECTED.PEDIDOS}${fromPedidos ? `?from=${fromPedidos}` : ''}`,
        icon: <FileText className="w-4 h-4" />,
      })
    } else if (pathname.startsWith('/home/kds')) {
      items.push({
        label: 'Cocina',
        path: '/home/kds',
        icon: <ChefHat className="w-4 h-4" />,
      })
    }
  }

  const searchKey = searchParams.toString()

  useEffect(() => {
    setNavigatingTo(null)
  }, [pathname, searchKey])

  useEffect(() => {
    if (!navigatingTo) return
    const t = setTimeout(() => setNavigatingTo(null), NAV_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [navigatingTo])

  const isNavigating = navigatingTo !== null

  const handleClick = (path: string, isLast: boolean) => {
    if (!isLast && !isNavigating) {
      setNavigatingTo(path)
      router.push(path)
    }
  }

  /** En Cocina 3D: mismos estilos que el breadcrumb, enlaces en línea tras "Cocina 3D" */
  const showCocinaQuickNav =
    isAdmin && pathname.startsWith(ROUTES.PROTECTED.COCINA)

  const clientesHref = `${ROUTES.PROTECTED.CLIENTES}?from=${ROUTES.CLIENTES_FROM.ADMIN}`
  const pedidosHref = `${ROUTES.PROTECTED.PEDIDOS}?from=${ROUTES.PEDIDOS_FROM.HOME}`

  /** Alineado con `AppDashboardCard` / tarjetas del inicio */
  const quickLinks: { label: string; href: string; icon: ReactNode; color: 'orange' | 'blue' | 'purple' | 'green' }[] = [
    {
      label: 'POS',
      href: ROUTES.PROTECTED.POS,
      icon: <ShoppingCart className="w-4 h-4" />,
      color: 'orange',
    },
    {
      label: 'Admin',
      href: ROUTES.PROTECTED.ADMIN,
      icon: <LayoutDashboard className="w-4 h-4" />,
      color: 'blue',
    },
    {
      label: 'Clientes',
      href: clientesHref,
      icon: <Users className="w-4 h-4" />,
      color: 'purple',
    },
    {
      label: 'Historial de pedidos',
      href: pedidosHref,
      icon: <FileText className="w-4 h-4" />,
      color: 'green',
    },
  ]

  const linkSecondaryClass = darkMode
    ? 'text-gray-400 hover:text-orange-400'
    : 'text-gray-600 hover:text-orange-600'

  const accentLink = {
    orange: darkMode
      ? 'text-orange-400 hover:text-orange-300'
      : 'text-orange-600 hover:text-orange-700',
    blue: darkMode
      ? 'text-blue-400 hover:text-blue-300'
      : 'text-blue-600 hover:text-blue-700',
    purple: darkMode
      ? 'text-purple-400 hover:text-purple-300'
      : 'text-purple-600 hover:text-purple-700',
    green: darkMode
      ? 'text-emerald-400 hover:text-emerald-300'
      : 'text-emerald-600 hover:text-emerald-700',
    red: darkMode ? 'text-red-400' : 'text-red-600',
  } as const

  function breadcrumbSegmentClass(item: BreadcrumbItem, isLast: boolean): string {
    if (showCocinaQuickNav) {
      if (item.label === 'Inicio' && !isLast) {
        return `${linkSecondaryClass} hover:underline`
      }
      if (item.label === 'Administración' && !isLast) {
        return `${accentLink.blue} hover:underline`
      }
      if (item.label === 'Cocina 3D' && isLast) {
        return `${accentLink.red} font-semibold cursor-default`
      }
      if (item.label === 'Inicio' && isLast) {
        return `${accentLink.red} font-semibold cursor-default`
      }
    }
    if (isLast) {
      return darkMode
        ? 'text-white font-semibold cursor-default'
        : 'text-gray-900 font-semibold cursor-default'
    }
    return `${linkSecondaryClass} hover:underline`
  }

  return (
    <nav
      className={`flex w-full min-w-0 flex-wrap items-center gap-1.5 text-sm ${
        darkMode ? 'text-gray-400' : 'text-gray-600'
      }`}
      aria-label={showCocinaQuickNav ? 'Breadcrumb y accesos' : 'Breadcrumb'}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1

        return (
          <div key={`${item.path}-${index}`} className="flex items-center gap-1.5">
            {index > 0 && (
              <ChevronRight
                className={`w-4 h-4 shrink-0 ${
                  darkMode ? 'text-gray-600' : 'text-gray-400'
                }`}
              />
            )}
            <button
              type="button"
              onClick={() => handleClick(item.path, isLast)}
              disabled={isLast || isNavigating}
              aria-busy={navigatingTo === item.path}
              className={`flex items-center gap-1.5 transition-colors disabled:opacity-60 ${breadcrumbSegmentClass(item, isLast)}`}
            >
              {navigatingTo === item.path ? (
                <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                item.icon && <span className="flex-shrink-0">{item.icon}</span>
              )}
              <span>{item.label}</span>
            </button>
          </div>
        )
      })}

      {showCocinaQuickNav &&
        quickLinks.map((link) => (
          <div key={link.href} className="flex items-center gap-1.5">
            <ChevronRight
              className={`w-4 h-4 shrink-0 ${
                darkMode ? 'text-gray-600' : 'text-gray-400'
              }`}
            />
            <button
              type="button"
              onClick={() => {
                if (isNavigating) return
                setNavigatingTo(link.href)
                router.push(link.href)
              }}
              disabled={isNavigating}
              aria-busy={navigatingTo === link.href}
              className={`flex items-center gap-1.5 transition-colors disabled:opacity-60 ${accentLink[link.color]} hover:underline`}
            >
              {navigatingTo === link.href ? (
                <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <span className="flex-shrink-0">{link.icon}</span>
              )}
              <span>{link.label}</span>
            </button>
          </div>
        ))}
    </nav>
  )
}
