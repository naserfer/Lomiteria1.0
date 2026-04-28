/**
 * Lógica de enrutamiento por roles de usuario
 */

import { ROUTES } from './routes'

export type UserRole = 'owner' | 'admin' | 'cajero' | 'cocinero' | 'repartidor'

/**
 * Configuración de acceso por rol
 */
export const ROLE_ACCESS = {
  owner: {
    defaultRoute: ROUTES.PROTECTED.OWNER,
    allowedRoutes: [
      ROUTES.PROTECTED.OWNER,
    ],
  },
  admin: {
    defaultRoute: ROUTES.PROTECTED.HOME,
    allowedRoutes: [
      ROUTES.PROTECTED.HOME,
      ROUTES.PROTECTED.POS,
      ROUTES.PROTECTED.MESAS,
      ROUTES.PROTECTED.PEDIDOS,
      ROUTES.PROTECTED.ADMIN,
      ROUTES.PROTECTED.CONFIGURACION,
    ],
  },
  cajero: {
    defaultRoute: ROUTES.PROTECTED.POS,
    allowedRoutes: [
      ROUTES.PROTECTED.HOME,
      ROUTES.PROTECTED.POS,
      ROUTES.PROTECTED.MESAS,
    ],
  },
  cocinero: {
    defaultRoute: ROUTES.PROTECTED.PEDIDOS,
    allowedRoutes: [ROUTES.PROTECTED.PEDIDOS],
  },
  repartidor: {
    defaultRoute: ROUTES.PROTECTED.POS,
    allowedRoutes: [ROUTES.PROTECTED.POS, ROUTES.PROTECTED.MESAS, ROUTES.PROTECTED.PEDIDOS],
  },
} as const

/**
 * Obtiene la ruta por defecto según el rol del usuario
 */
export function getDefaultRouteByRole(role: UserRole): string {
  return ROLE_ACCESS[role]?.defaultRoute || ROUTES.PROTECTED.HOME
}

/**
 * Verifica si un rol tiene acceso a una ruta específica
 */
export function hasRoleAccess(role: UserRole, pathname: string): boolean {
  const roleConfig = ROLE_ACCESS[role]
  if (!roleConfig) return false

  return roleConfig.allowedRoutes.some(route =>
    pathname === route || pathname.startsWith(route + '/')
  )
}

/**
 * Obtiene la ruta de redirección después del login
 */
export function getPostLoginRoute(role: UserRole): string {
  return getDefaultRouteByRole(role)
}

/**
 * Obtiene la ruta de redirección cuando no hay acceso
 */
export function getUnauthorizedRedirect(role: UserRole): string {
  return getDefaultRouteByRole(role)
}

/**
 * Ruta de logout (siempre redirige al login)
 */
export function getLogoutRoute(): string {
  return ROUTES.PUBLIC.LOGIN
}
