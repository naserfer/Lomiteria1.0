/**
 * Auth Module - Constants
 * Constantes de configuración del módulo de autenticación
 */

// Theme Configuration
export const THEME_CONFIG = {
  LIGHT: {
    name: 'light',
    background: 'bg-white',
    text: 'text-gray-900',
    card: 'bg-white',
    border: 'border-orange-100',
  },
  DARK: {
    name: 'dark',
    background: 'bg-gradient-to-br from-gray-900 via-gray-950 to-gray-900',
    text: 'text-gray-100',
    card: 'bg-gray-800',
    border: 'border-gray-700',
  },
} as const

// Types
export type ThemeMode = keyof typeof THEME_CONFIG

// ─────────────────────────────────────────────────────────────────────────────
// Feature flags (frontend)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Producción actual: sin factura → dejar en false.
 * Cuando habiliten impresión/facturación → cambiar a true.
 */
export const POS_FACTURA_MODAL_ENABLED = false

// ─────────────────────────────────────────────────────────────────────────────
// Ajustes a medida por tenant
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tenants que comparten los mismos ajustes de POS/mesas que Oriental 8
 * (p. ej. ver detalle de mesa, ítem manual en carrito).
 * Para sumar otro cliente, solo agrega su UUID aquí.
 */
export const TENANT_IDS_ORIENTAL_CUSTOM: readonly string[] = [
  '565c0876-2235-4e7c-bb54-89c466fe4583',
  '26ab2897-c8d4-4768-be6e-7c1fee8500e9'
]

/** True si `tenantId` está en {@link TENANT_IDS_ORIENTAL_CUSTOM}. */
export function tenantHasOrientalCustomPOSFeatures(
  tenantId: string | undefined | null,
): boolean {
  if (tenantId == null || tenantId === '') return false
  return TENANT_IDS_ORIENTAL_CUSTOM.includes(tenantId)
}
