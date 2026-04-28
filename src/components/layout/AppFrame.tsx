'use client'

import { ReactNode, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ROUTES } from '@/config/routes'
import { AppNavbar } from './AppNavbar'
import { AppFooter } from './AppFooter'
import { InactiveTenantOverlay } from '@/components/ui/InactiveTenantOverlay'
import { useTenant } from '@/contexts/TenantContext'
import { THEME_CONFIG } from '@/utils/constants'

type PageInfo = {
  title: string
  subtitle?: string
  fullWidth?: boolean
}

const NAV_EXCLUDED_PATHS = ['/', ROUTES.PUBLIC.LOGIN]
const NAV_EXCLUDED_PREFIXES = ['/carta/']

const PAGE_MAP: Array<{ test: (pathname: string) => boolean; info: PageInfo }> = [
  {
    test: (path) => path === '/home',
    info: {
      title: 'Panel de inicio',
    }
  },
  {
    test: (path) => path.startsWith('/home/mesas'),
    info: {
      title: 'Mesas',
      subtitle: 'Gestioná ocupación, reservas y pedidos por mesa.',
    }
  },
  {
    test: (path) => path.startsWith('/home/admin/cocina'),
    info: {
      title: 'Cocina 3D',
      subtitle: 'Visualizá el flujo de pedidos en tu cocina 3D en tiempo real.',
      fullWidth: true
    }
  },
  {
    test: (path) => path.startsWith('/home/admin'),
    info: {
      title: 'Dashboard general',
      subtitle: 'Ventas, inventario y caja en un solo lugar.'
    }
  },
  {
    test: (path) => path.startsWith('/home/pos'),
    info: {
      title: 'Punto de Venta',
      subtitle: 'Cobrá más rápido y controlá el pedido al detalle.',
      fullWidth: true
    }
  },
  {
    test: (path) => path.startsWith('/home/pedidos'),
    info: {
      title: 'Historial de pedidos',
      subtitle: 'Reimprimí cocina o factura; anulación solo para administradores.'
    }
  },
  {
    test: (path) => path.startsWith('/home/configuracion'),
    info: {
      title: 'Configuración del negocio',
      subtitle: 'Datos del local, fiscales y contacto.'
    }
  },
  {
    test: (path) => path === '/owner',
    info: {
      title: 'Panel Owner',
      subtitle: 'Gestioná todas las lomiterías de la plataforma.'
    }
  },
  {
    test: (path) => path.startsWith('/owner/tenants'),
    info: {
      title: 'Lomiterías',
      subtitle: 'Creá y administrá los negocios registrados.'
    }
  },
]

const DEFAULT_INFO: PageInfo = {
  title: 'LomiPos',
  subtitle: 'La solución todo en uno para tu negocio.'
}

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { darkMode, tenant } = useTenant()

  // Prefetch POS para que el primer clic no dispare un RSC lento
  useEffect(() => {
    if (tenant) router.prefetch(ROUTES.PROTECTED.POS)
  }, [tenant, router])

  // Ocultar navbar en rutas de autenticación
  const hideNavbar = NAV_EXCLUDED_PATHS.includes(pathname) || NAV_EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  // POS y Cocina usan layout de altura bloqueada para priorizar workspace interno.
  // No aplicamos esto al resto de la app para no afectar el scrollbar global.
  const isPosPage = pathname.startsWith('/home/pos')
  const isKitchenPage = pathname.startsWith('/home/admin/cocina')
  const isWorkspacePage = isPosPage || isKitchenPage
  
  const pageInfo =
    PAGE_MAP.find((entry) => entry.test(pathname))?.info ??
    DEFAULT_INFO

  const isLandingPage = pathname === '/'
  const isLoginPage = pathname === ROUTES.PUBLIC.LOGIN
  const isPublicCartaPage = pathname.startsWith('/carta/')
  const isAuthLikePage = isLandingPage || isLoginPage || isPublicCartaPage
  /** Login/carta: main crece para dejar el footer al fondo del viewport (sticky visual). */
  const mainFillsViewportAboveFooter =
    isAuthLikePage && !isLandingPage

  const frameBackgroundClass = isLandingPage
    ? THEME_CONFIG.LIGHT.background
    : hideNavbar
      ? THEME_CONFIG.DARK.background
      : darkMode
        ? THEME_CONFIG.DARK.background
        : THEME_CONFIG.LIGHT.background

  const frameTextClass = isLandingPage
    ? THEME_CONFIG.LIGHT.text
    : darkMode
      ? THEME_CONFIG.DARK.text
      : THEME_CONFIG.LIGHT.text

  return (
    <div
      className={`flex w-full min-w-0 flex-col ${
        isAuthLikePage
          ? 'min-h-[100dvh] min-h-screen overflow-y-auto'
          : isPosPage
            ? 'h-[100dvh] min-h-0 overflow-hidden'
            : isKitchenPage
              ? 'h-[100dvh] min-h-0 overflow-hidden'
            : 'min-h-screen'
      } ${frameBackgroundClass} ${frameTextClass}`}
    >
      {!hideNavbar && (
        <AppNavbar pageTitle={pageInfo.title} pageSubtitle={pageInfo.subtitle} />
      )}
      <InactiveTenantOverlay />
      <main
        className={`flex flex-col ${
          mainFillsViewportAboveFooter || !isAuthLikePage
            ? 'flex-1 min-h-0 min-w-0'
            : ''
        } ${
          isAuthLikePage
            ? 'min-w-0 px-0'
            : pageInfo.fullWidth
              ? (isPosPage || isKitchenPage ? 'py-0' : 'py-4')
              : 'py-6'
        }         ${
          isLoginPage
            ? 'overflow-y-auto overflow-x-hidden overscroll-y-auto scrollbar-none'
            : ''
        } ${!isAuthLikePage && (isPosPage || isKitchenPage) ? 'overflow-hidden' : ''}`}
        style={
          isAuthLikePage
            ? { paddingTop: 'env(safe-area-inset-top, 0px)' }
            : !pageInfo.fullWidth
              ? {
                  paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
                  paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
                }
              : undefined
        }
      >
        {pageInfo.fullWidth || isLandingPage || isLoginPage ? (
          children
        ) : (
          <div className="w-full min-w-0 max-w-7xl mx-auto space-y-10 overflow-x-hidden">{children}</div>
        )}
      </main>
      {!isWorkspacePage && !isLandingPage && (
        <AppFooter
          isDark={hideNavbar || darkMode}
          variant={isLoginPage ? 'login' : 'default'}
        />
      )}
    </div>
  );
}


