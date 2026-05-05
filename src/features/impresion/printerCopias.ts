import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Valores de copias en printer_config (1 o 2). Si no hay fila o falla la lectura → 1.
 * Usado para encolar jobs extra vía reprint_solicitud (mismo canal que “Reimprimir”).
 */
export async function getPrinterCopiasConfig(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ copias_ticket_cocina: 1 | 2; copias_factura_cierre: 1 | 2 }> {
  const { data, error } = await supabase
    .from('printer_config')
    .select('copias_ticket_cocina, copias_factura_cierre')
    .eq('lomiteria_id', tenantId)
    .maybeSingle()

  if (error || !data) {
    return { copias_ticket_cocina: 1, copias_factura_cierre: 1 }
  }

  return {
    copias_ticket_cocina: Number(data.copias_ticket_cocina) === 2 ? 2 : 1,
    copias_factura_cierre: Number(data.copias_factura_cierre) === 2 ? 2 : 1,
  }
}
