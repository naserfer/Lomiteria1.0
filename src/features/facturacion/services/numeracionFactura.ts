import type { createClient } from '@/lib/supabase/client'

type SupabaseClient = ReturnType<typeof createClient>

/** Prefijo `EEE-PPP-` del número de factura (establecimiento-punto). */
export function buildPrefijoNumeracion(establecimiento: string, puntoExpedicion: string): string {
  return `${establecimiento}-${puntoExpedicion}-`
}

/** Extrae la parte numérica final (7 dígitos) si coincide el prefijo esperado. */
export function parseSecuenciaNumerica(numeroFactura: string, prefijo: string): number | null {
  if (!numeroFactura.startsWith(prefijo)) return null
  const rest = numeroFactura.slice(prefijo.length)
  const n = parseInt(rest, 10)
  return Number.isNaN(n) ? null : n
}

/**
 * Mayor secuencia ya usada en `facturas` para el prefijo fiscal del local.
 * Evita choques cuando `tenant_facturacion.ultimo_numero` quedó desfasado (importaciones, restores, fallos parciales).
 */
export async function maxSecuenciaNumericaEnFacturas(
  supabase: SupabaseClient,
  tenantId: string,
  establecimiento: string,
  puntoExpedicion: string
): Promise<number> {
  const prefijo = buildPrefijoNumeracion(establecimiento, puntoExpedicion)
  const { data, error } = await supabase
    .from('facturas')
    .select('numero_factura')
    .eq('tenant_id', tenantId)
    .like('numero_factura', `${prefijo}%`)

  if (error) {
    throw new Error(`No se pudo leer numeración de facturas existentes: ${error.message}`)
  }

  let max = 0
  for (const row of data ?? []) {
    const n = parseSecuenciaNumerica(row.numero_factura, prefijo)
    if (n !== null) max = Math.max(max, n)
  }
  return max
}

/** Siguiente valor de secuencia: nunca menor que el máximo ya persistido en `facturas`. */
export function siguienteSecuenciaFactura(ultimoEnConfig: number, maxEnTablaFacturas: number): number {
  return Math.max(ultimoEnConfig ?? 0, maxEnTablaFacturas) + 1
}

export function esErrorNumeroFacturaDuplicado(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '23505') return true
  const m = (error.message ?? '').toLowerCase()
  return m.includes('duplicate key') && m.includes('facturas_numero_tenant_unique')
}
