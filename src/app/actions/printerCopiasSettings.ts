'use server'

import { createClient } from '@/lib/supabase/server'

/** Texto legible con todo lo que devuelve PostgREST/Postgres (para la UI y consola). */
function formatSupabaseError(
  context: string,
  err: { message?: string; code?: string; details?: string; hint?: string } | null
) {
  if (!err) return context
  const bits: string[] = [context]
  if (err.message) bits.push(err.message)
  if (err.code) bits.push(`código: ${err.code}`)
  if (err.details) bits.push(`detalle: ${err.details}`)
  if (err.hint) bits.push(`hint: ${err.hint}`)
  return bits.join(' — ')
}

async function assertAdminOfTenant(tenantId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: usuario, error: uErr } = await supabase
    .from('usuarios')
    .select('rol, tenant_id')
    .eq('auth_user_id', user.id)
    .eq('is_deleted', false)
    .single()

  if (uErr || !usuario) {
    return { error: formatSupabaseError('Usuario no encontrado o error al leer perfil', uErr) }
  }
  if (usuario.rol !== 'admin') return { error: 'Sin permisos' }
  if (usuario.tenant_id !== tenantId) return { error: 'Sin permisos' }
  return { error: null }
}

export type CopiasSetting = 1 | 2

/**
 * Lee copias configuradas para impresión (admin del local, mismo tenant).
 */
export async function getPrinterCopiasForTenant(tenantId: string) {
  const gate = await assertAdminOfTenant(tenantId)
  if (gate.error) {
    return {
      error: gate.error,
      copias_ticket_cocina: null as CopiasSetting | null,
      copias_factura_cierre: null as CopiasSetting | null,
      hasPrinterRow: false,
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('printer_config')
    .select('copias_ticket_cocina, copias_factura_cierre')
    .eq('lomiteria_id', tenantId)
    .limit(2)

  if (error) {
    console.error('[getPrinterCopiasForTenant]', error)
    const msg = error.message ?? ''
    const base =
      /column|does not exist|schema cache/i.test(msg)
        ? 'Probablemente falta la migración database/32_printer_config_copias.sql.'
        : /42501|permission denied/i.test(msg)
          ? 'Permiso denegado en printer_config. Ejecutá en Supabase database/33_printer_config_rls_tenant.sql (políticas RLS + GRANT).'
          : 'No se pudo leer printer_config.'
    return {
      error: formatSupabaseError(base, error),
      copias_ticket_cocina: null,
      copias_factura_cierre: null,
      hasPrinterRow: false,
    }
  }

  const rows = data ?? []
  if (rows.length > 1) {
    console.error('[getPrinterCopiasForTenant] hay más de una fila printer_config para el mismo local')
    return {
      error: 'Hay datos duplicados de impresora para este local. Revisá printer_config en Supabase.',
      copias_ticket_cocina: null,
      copias_factura_cierre: null,
      hasPrinterRow: false,
    }
  }

  const row = rows[0]

  if (!row) {
    return {
      error: null,
      copias_ticket_cocina: 1 as CopiasSetting,
      copias_factura_cierre: 1 as CopiasSetting,
      hasPrinterRow: false,
    }
  }

  return {
    error: null,
    copias_ticket_cocina: (row.copias_ticket_cocina === 2 ? 2 : 1) as CopiasSetting,
    copias_factura_cierre: (row.copias_factura_cierre === 2 ? 2 : 1) as CopiasSetting,
    hasPrinterRow: true,
  }
}

/**
 * Guarda preferencias de copias. Requiere fila en printer_config (creada desde panel owner al dar de alta el local).
 */
export async function updatePrinterCopiasForTenant(
  tenantId: string,
  payload: { copias_ticket_cocina: CopiasSetting; copias_factura_cierre: CopiasSetting }
) {
  const gate = await assertAdminOfTenant(tenantId)
  if (gate.error) return { error: gate.error }

  const supabase = await createClient()
  const { data: updated, error } = await supabase
    .from('printer_config')
    .update({
      copias_ticket_cocina: payload.copias_ticket_cocina,
      copias_factura_cierre: payload.copias_factura_cierre,
      updated_at: new Date().toISOString(),
    })
    .eq('lomiteria_id', tenantId)
    .select('id')

  if (error) {
    console.error('[updatePrinterCopiasForTenant]', error)
    const msg = error.message ?? ''
    const base =
      /column|does not exist|schema cache/i.test(msg)
        ? 'Probablemente falta la migración database/32_printer_config_copias.sql.'
        : /42501|permission denied/i.test(msg)
          ? 'Permiso denegado al guardar. Ejecutá en Supabase database/33_printer_config_rls_tenant.sql.'
          : 'No se pudo guardar en printer_config.'
    return { error: formatSupabaseError(base, error) }
  }

  const n = updated?.length ?? 0
  if (n === 0) {
    return {
      error:
        'Aún no hay impresora registrada para este local. Pedí en KarúBox que configuren la impresora del negocio; después podrás elegir las copias aquí.',
    }
  }
  if (n > 1) {
    console.error('[updatePrinterCopiasForTenant] se actualizaron varias filas; revisá printer_config')
  }

  return { error: null }
}
