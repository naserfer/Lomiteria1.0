/**
 * Definición centralizada de todas las rutas de la aplicación
 */

export const ROUTES = {
  // Rutas públicas (sin autenticación)
  PUBLIC: {
    LOGIN: '/login',
    CARTA_QR: '/carta',
  },

  // Rutas protegidas (requieren autenticación)
  PROTECTED: {
    HOME: '/home',
    POS: '/home/pos',
    MESAS: '/home/mesas',
    PEDIDOS: '/home/pedidos',
    ADMIN: '/home/admin',
    CLIENTES: '/home/admin/clientes',
    COCINA: '/home/admin/cocina',
    CONFIGURACION: '/home/configuracion',
    OWNER: '/owner',
    // KDS: '/home/kds',
    // INVENTARIO: '/home/dashboard/inventario',
    // REPORTES: '/home/dashboard/reportes',
  },

  /** Query param para breadcrumb de Cocina 3D: 'home' = desde Inicio, 'admin' = desde Administración */
  COCINA_FROM: {
    HOME: 'home',
    ADMIN: 'admin',
  } as const,

  /** Query param para breadcrumb de Clientes: 'home' = desde Inicio, 'admin' = desde Administración */
  CLIENTES_FROM: {
    HOME: 'home',
    ADMIN: 'admin',
  } as const,

  /** Query param para breadcrumb de Historial de pedidos: 'home' = desde Inicio, 'pos' = desde Punto de Venta */
  PEDIDOS_FROM: {
    HOME: 'home',
    POS: 'pos',
  } as const,

  // Rutas de API (futuro)
  API: {
    AUTH: '/api/auth',
    PRODUCTOS: '/api/productos',
    PEDIDOS: '/api/pedidos',
    CLIENTES: '/api/clientes',
  },
} as const

/** Ruta pública de carta QR por local (slug de tenant). */
export function getPublicCartaQrPath(tenantSlug: string): string {
  return `${ROUTES.PUBLIC.CARTA_QR}/${encodeURIComponent(tenantSlug)}`
}

/**
 * Origen canónico del sitio (sin barra final). Si está definido `NEXT_PUBLIC_SITE_URL`,
 * el QR y el enlace copiado usan ese dominio (útil detrás de proxy o para forzar www).
 */
export function getPublicSiteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (raw) return raw.replace(/\/$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

/** URL absoluta de la carta pública (QR y copiar). */
export function getAbsoluteCartaQrUrl(tenantSlug: string): string | null {
  const path = getPublicCartaQrPath(tenantSlug)
  const origin = getPublicSiteOrigin()
  if (!origin) return null
  return `${origin}${path}`
}

/**
 * Lista de rutas públicas que no requieren autenticación
 */
export const PUBLIC_ROUTES = [
  ROUTES.PUBLIC.LOGIN,
  ROUTES.PUBLIC.CARTA_QR,
] as const

/**
 * Lista de rutas protegidas que requieren autenticación
 */
export const PROTECTED_ROUTES = Object.values(ROUTES.PROTECTED)

/**
 * Verifica si una ruta es pública
 */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route))
}

/**
 * Rutas donde el marketing / carta pública deben verse siempre en modo claro en el DOM.
 * Evita que `class="dark"` en <html> (preferencia del POS) active `dark:` de Tailwind en la landing.
 */
export function isMarketingLightDomPath(pathname: string): boolean {
  if (pathname === '/') return true
  return isPublicRoute(pathname)
}

/**
 * Verifica si una ruta es protegida
 */
export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(route => pathname === route || pathname.startsWith(route))
}

/**
 * Obtiene la ruta base de una ruta completa
 * Ejemplo: /home/pos/123 -> /home/pos
 */
export function getBaseRoute(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length <= 2) return pathname
  return `/${segments.slice(0, 2).join('/')}`
}
