import { createClient } from '@/lib/supabase/client'
import { requestAgentPrint } from '@/features/impresion/agentPrintClient'
import { getPrinterCopiasConfig } from '@/features/impresion/printerCopias'
import {
  RECEPTOR_FACTURA_GENERICO_CI,
  RECEPTOR_FACTURA_GENERICO_NOMBRE,
  RECEPTOR_FACTURA_GENERICO_RUC,
  clienteTieneRucParaFactura,
} from '@/features/pos/utils/pos.utils'

async function buildMissingFiscalConfigWarning(
  supabase: ReturnType<typeof createClient>,
  tenantId: string
): Promise<string> {
  const baseMessage =
    `No hay configuración de facturación para este local (tenant ${tenantId}). ` +
    'No se pudo emitir/imprimir factura al cerrar la cuenta.'

  try {
    const { data: latestConfigs, error } = await supabase
      .from('tenant_facturacion')
      .select('tenant_id, establecimiento, punto_expedicion, updated_at')
      .order('updated_at', { ascending: false })
      .limit(5)

    if (error || !latestConfigs || latestConfigs.length === 0) {
      return `${baseMessage} Cargá tenant_facturacion y reintentá imprimir la factura.`
    }

    const hasCurrentTenantConfig = latestConfigs.some((row) => row.tenant_id === tenantId)
    if (hasCurrentTenantConfig) {
      return baseMessage
    }

    const otherTenants = latestConfigs
      .map((row) => row.tenant_id)
      .filter((id): id is string => Boolean(id))
      .filter((id) => id !== tenantId)
      .slice(0, 3)

    if (otherTenants.length === 0) {
      return `${baseMessage} Cargá tenant_facturacion y reintentá imprimir la factura.`
    }

    return (
      `${baseMessage} ` +
      `Se detectó configuración fiscal en otros tenant(s): ${otherTenants.join(', ')}. ` +
      `Verificá el tenant activo o cargá tenant_facturacion para ${tenantId}.`
    )
  } catch {
    return `${baseMessage} Cargá tenant_facturacion y reintentá imprimir la factura.`
  }
}

interface CerrarCuentaParaLlevarParams {
  tenantId: string
  pedidoId: string
  usuarioId?: string | null
  metodoCobro?: 'tarjeta' | 'efectivo' | null
}

interface CerrarCuentaParaLlevarResult {
  pedidoId: string
  numeroPedido: number
  facturaEmitidaAhora: boolean
  facturaYaExistia: boolean
  mensajeImpresion: string
  warning: string | null
}

export const cerrarCuentaParaLlevarService = {
  async cerrarCuenta(params: CerrarCuentaParaLlevarParams): Promise<CerrarCuentaParaLlevarResult> {
    const supabase = createClient()

    const { data: pedidoPrincipal, error: pedidoError } = await supabase
      .from('pedidos')
      .select('id, numero_pedido, total, cliente_id, estado, estado_pedido, mesa_id')
      .eq('tenant_id', params.tenantId)
      .eq('id', params.pedidoId)
      .maybeSingle()

    if (pedidoError) throw new Error(`No se pudo cargar el pedido: ${pedidoError.message}`)
    if (!pedidoPrincipal) throw new Error('El pedido no existe.')
    if (pedidoPrincipal.mesa_id != null) {
      throw new Error('Este pedido está vinculado a una mesa. Usá el cierre de cuenta de mesa.')
    }
    if (pedidoPrincipal.estado === 'cancelado') {
      throw new Error('El pedido está cancelado.')
    }
    if (pedidoPrincipal.estado_pedido !== 'FACT') {
      throw new Error('El pedido debe estar en estado FACT para cerrar la cuenta.')
    }

    const { data: config, error: configError } = await supabase
      .from('tenant_facturacion')
      .select('timbrado, establecimiento, punto_expedicion, ultimo_numero')
      .eq('tenant_id', params.tenantId)
      .maybeSingle()

    if (configError) throw new Error(`No se pudo cargar configuración fiscal: ${configError.message}`)

    let ultimoNumeroActual = config?.ultimo_numero ?? 0
    let facturaEmitidaAhora = false
    let facturaYaExistia = false
    let warning: string | null = null
    let metodoCobroDisponible = true

    let { data: facturaExistente, error: facturaExistenteError } = await supabase
      .from('facturas')
      .select('id, metodo_cobro')
      .eq('tenant_id', params.tenantId)
      .eq('pedido_id', pedidoPrincipal.id)
      .or('anulada.is.null,anulada.eq.false')
      .maybeSingle()

    if (facturaExistenteError?.message?.toLowerCase().includes('metodo_cobro')) {
      metodoCobroDisponible = false
      const fallback = await supabase
        .from('facturas')
        .select('id')
        .eq('tenant_id', params.tenantId)
        .eq('pedido_id', pedidoPrincipal.id)
        .or('anulada.is.null,anulada.eq.false')
        .maybeSingle()
      facturaExistente = fallback.data
        ? { id: fallback.data.id, metodo_cobro: null }
        : null
      facturaExistenteError = fallback.error
    }

    if (facturaExistenteError) {
      throw new Error(
        `No se pudo verificar la factura del pedido #${pedidoPrincipal.numero_pedido}: ${facturaExistenteError.message}`
      )
    }

    facturaYaExistia = Boolean(facturaExistente?.id)

    if (
      metodoCobroDisponible &&
      facturaYaExistia &&
      params.metodoCobro &&
      facturaExistente &&
      !facturaExistente.metodo_cobro
    ) {
      const { error: updateMetodoError } = await supabase
        .from('facturas')
        .update({ metodo_cobro: params.metodoCobro, updated_at: new Date().toISOString() })
        .eq('id', facturaExistente.id)
        .eq('tenant_id', params.tenantId)
      if (updateMetodoError && !updateMetodoError.message?.toLowerCase().includes('metodo_cobro')) {
        throw new Error(`No se pudo actualizar método de cobro en factura existente: ${updateMetodoError.message}`)
      }
    }

    if (!facturaYaExistia) {
      if (!config) {
        warning = await buildMissingFiscalConfigWarning(supabase, params.tenantId)
        console.error('[cerrarCuentaParaLlevar] tenant sin configuración fiscal', {
          tenantId: params.tenantId,
          pedidoId: pedidoPrincipal.id,
        })
      } else {
        let clienteFacturaId: string | null = null
        let receptorNombre: string | null = null
        let receptorRuc: string | null = null
        let receptorCi: string | null = null

        if (pedidoPrincipal.cliente_id) {
          const { data: cliente, error: clienteError } = await supabase
            .from('clientes')
            .select('id, nombre, ci, ruc')
            .eq('tenant_id', params.tenantId)
            .eq('id', pedidoPrincipal.cliente_id)
            .maybeSingle()

          if (clienteError) throw new Error(`No se pudo cargar cliente para facturar: ${clienteError.message}`)

          if (cliente && clienteTieneRucParaFactura({ ruc: cliente.ruc })) {
            clienteFacturaId = cliente.id
          } else if (cliente) {
            receptorNombre = cliente.nombre?.trim() || RECEPTOR_FACTURA_GENERICO_NOMBRE
            receptorCi = cliente.ci?.trim() || RECEPTOR_FACTURA_GENERICO_CI
          } else {
            receptorNombre = RECEPTOR_FACTURA_GENERICO_NOMBRE
            receptorRuc = RECEPTOR_FACTURA_GENERICO_RUC
          }
        } else {
          receptorNombre = RECEPTOR_FACTURA_GENERICO_NOMBRE
          receptorRuc = RECEPTOR_FACTURA_GENERICO_RUC
        }

        const siguiente = ultimoNumeroActual + 1
        const numeroFactura = `${config.establecimiento}-${config.punto_expedicion}-${String(siguiente).padStart(7, '0')}`
        const total = Number(pedidoPrincipal.total ?? 0)
        const totalIva10 = Math.round((total / 1.1) * 0.1 * 100) / 100
        const totalExento = Math.round((total - totalIva10) * 100) / 100

        const facturaPayload = {
          tenant_id: params.tenantId,
          pedido_id: pedidoPrincipal.id,
          numero_factura: numeroFactura,
          timbrado: config.timbrado,
          cliente_id: clienteFacturaId,
          receptor_nombre_impresion: receptorNombre,
          receptor_ruc_impresion: receptorRuc,
          receptor_ci_impresion: receptorCi,
          total,
          total_iva_10: totalIva10,
          total_iva_5: 0,
          total_exento: totalExento,
        }

        let { error: facturaInsertError } = await supabase.from('facturas').insert(
          metodoCobroDisponible
            ? { ...facturaPayload, metodo_cobro: params.metodoCobro ?? null }
            : facturaPayload
        )

        if (facturaInsertError?.message?.toLowerCase().includes('metodo_cobro')) {
          metodoCobroDisponible = false
          const fallback = await supabase.from('facturas').insert(facturaPayload)
          facturaInsertError = fallback.error
        }

        if (facturaInsertError) {
          throw new Error(`No se pudo emitir la factura: ${facturaInsertError.message}`)
        }

        const { error: updateConfigError } = await supabase
          .from('tenant_facturacion')
          .update({ ultimo_numero: siguiente, updated_at: new Date().toISOString() })
          .eq('tenant_id', params.tenantId)

        if (updateConfigError) {
          throw new Error(`No se pudo actualizar la numeración fiscal: ${updateConfigError.message}`)
        }

        ultimoNumeroActual = siguiente
        facturaEmitidaAhora = true
      }
    }

    let mensajeImpresion = 'No se imprimió factura en el cierre de cuenta.'
    if (facturaYaExistia || facturaEmitidaAhora) {
      const { copias_factura_cierre } = await getPrinterCopiasConfig(supabase, params.tenantId)
      try {
        for (let i = 0; i < copias_factura_cierre; i++) {
          mensajeImpresion = await requestAgentPrint(pedidoPrincipal.id, 'factura', params.tenantId)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo encolar la impresión de factura.'
        warning = warning ? `${warning} ${message}` : message
      }
    }

    return {
      pedidoId: pedidoPrincipal.id,
      numeroPedido: Number(pedidoPrincipal.numero_pedido),
      facturaEmitidaAhora,
      facturaYaExistia,
      mensajeImpresion,
      warning,
    }
  },
}
