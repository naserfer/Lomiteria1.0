'use client'

import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { AppNavbar } from './AppNavbar'
import { useTenant } from '@/features/auth/TenantContext'

type PageInfo = {
  title: string
  subtitle?: string
  fullWidth?: boolean
}

const NAV_EXCLUDED_PATHS = ['/login']

const PAGE_MAP: Array<{ test: (pathname: string) => boolean; info: PageInfo }> = [
  {
    test: (path) => path.startsWith('/admin/clientes'),
    info: {
      title: 'Clientes & Fidelidad',
      subtitle: 'Segmentá, premiá y entendé el comportamiento de tus fans.'
    }
  },
  {
    test: (path) => path.startsWith('/admin'),
    info: {
      title: 'Dashboard general',
      subtitle: 'Ventas, inventario y caja en un solo lugar.'
    }
  },
  {
    test: (path) => path.startsWith('/pos'),
    info: {
      title: 'Punto de Venta',
      subtitle: 'Cobrá más rápido y controlá el pedido al detalle.',
      fullWidth: true
    }
  },
  {
    test: (path) => path.startsWith('/kds'),
    info: {
      title: 'Pantalla de cocina',
      subtitle: 'Pedidos en tiempo real para producción.',
      fullWidth: true
    }
  },
  {
    test: (path) => path === '/',
    info: {
      title: 'Ka\'u Manager',
      subtitle: 'Elegí el módulo que querés usar.'
    }
  }
]

const DEFAULT_INFO: PageInfo = {
  title: 'Ka\'u Manager',
  subtitle: 'Gestión centralizada para lomiterías.'
}

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { darkMode } = useTenant()

  const hideNavbar = NAV_EXCLUDED_PATHS.some((prefix) => pathname.startsWith(prefix))
  const pageInfo =
    PAGE_MAP.find((entry) => entry.test(pathname))?.info ??
    DEFAULT_INFO

  if (hideNavbar) {
    return <>{children}</>
  }

  return (
    <div
      className={`min-h-screen ${
        darkMode
          ? 'bg-gradient-to-br from-gray-900 via-gray-950 to-gray-900 text-gray-100'
          : 'bg-gradient-to-br from-orange-50 via-white to-orange-50 text-gray-900'
      }`}
    >
      <AppNavbar pageTitle={pageInfo.title} pageSubtitle={pageInfo.subtitle} />
      <main className={pageInfo.fullWidth ? 'py-4' : 'px-4 py-6'}>
        {pageInfo.fullWidth ? (
          children
        ) : (
          <div className="max-w-7xl mx-auto space-y-10">{children}</div>
        )}
      </main>
    </div>
  )
}


