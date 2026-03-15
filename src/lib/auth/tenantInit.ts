/**
 * Utilidades compartidas para el flujo de creación de tenants (SignUp / OAuth)
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Genera un slug URL-seguro a partir del nombre del negocio,
 * añadiendo un sufijo único basado en el UUID del usuario.
 */
export function buildTenantSlug(nombreNegocio: string, userId: string): string {
  const base = nombreNegocio
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)

  return `${base}-${userId.slice(0, 8)}`
}

/**
 * Crea las categorías por defecto para un tenant nuevo.
 * Se llama después de crear el tenant en la base de datos.
 */
export async function createDefaultCategories(
  supabase: SupabaseClient,
  tenantId: string
): Promise<void> {
  await supabase.from('categorias').insert([
    { tenant_id: tenantId, nombre: 'Hamburguesas', orden: 1, activa: true },
    { tenant_id: tenantId, nombre: 'Bebidas', orden: 2, activa: true },
    { tenant_id: tenantId, nombre: 'Entradas', orden: 3, activa: true },
    { tenant_id: tenantId, nombre: 'Postres', orden: 4, activa: true },
  ])
}
