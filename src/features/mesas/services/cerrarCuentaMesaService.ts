import { createClient } from '@/lib/supabase/client'
import { requestAgentPrint } from '@/features/impresion/agentPrintClient'
import {
  RECEPTOR_FACTURA_GENERICO_CI,
  RECEPTOR_FACTURA_GENERICO_NOMBRE,
  RECEPTOR_FACTURA_GENERICO_RUC,
  clienteTieneRucParaFactura,
} from '@/features/pos/utils/pos.utils'

interface CerrarCuentaMesaParams {
  tenantId: string
  mesaId: string
  usuarioId?: string | null
}

interface CerrarCuentaMesaResult {
  pedidoId: string
  numeroPedido: number
  facturaEmitidaAhora: boolean
  facturaYaExistia: boolean
  mensajeImpresion: string
  warning: string | null
}

async function buildMissingFiscalConfigWarning(
  supabase: ReturnType<typeof createClient>,
  tenantId: string
): Promise<string> {
  const baseMessage =
    `No hay configuración de facturación para este local (tenant ${tenantId}). ` +
    'Se cerró la mesa sin emitir/imprimir factura.'

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

export const cerrarCuentaMesaService = {
  async cerrarCuenta(params: CerrarCuentaMesaParams): Promise<CerrarCuentaMesaResult> {
    const supabase = createClient()

    const { data: mesa, error: mesaError } = await supabase
      .from('mesas')
      .select('id, numero, activa')
      .eq('tenant_id', params.tenantId)
      .eq('id', params.mesaId)
      .maybeSingle()

    if (mesaError) throw new Error(`No se pudo validar la mesa: ${mesaError.message}`)
    if (!mesa) throw new Error('La mesa no existe en este local.')
    if (!mesa.activa) throw new Error('La mesa está inactiva.')

    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .select('id, numero_pedido, total, cliente_id, estado, estado_pedido')
      .eq('tenant_id', params.tenantId)
      .eq('mesa_id', params.mesaId)
      .eq('estado_pedido', 'FACT')
      .neq('estado', 'cancelado')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (pedidoError) throw new Error(`No se pudo obtener el pedido activo de mesa: ${pedidoError.message}`)
    if (!pedido) throw new Error('No hay un pedido confirmado para cerrar en esta mesa.')

    const { data: facturaExistente, error: facturaExistenteError } = await supabase
      .from('facturas')
      .select('id')
      .eq('tenant_id', params.tenantId)
      .eq('pedido_id', pedido.id)
      .eq('anulada', false)
      .maybeSingle()

    if (facturaExistenteError) {
      throw new Error(`No se pudo verificar la factura del pedido: ${facturaExistenteError.message}`)
    }

    let facturaEmitidaAhora = false
    const facturaYaExistia = Boolean(facturaExistente?.id)
    let warning: string | null = null
    let mensajeImpresion = 'No se imprimió factura en el cierre de cuenta.'

    if (!facturaYaExistia) {
      const { data: config, error: configError } = await supabase
        .from('tenant_facturacion')
        .select('timbrado, establecimiento, punto_expedicion, ultimo_numero')
        .eq('tenant_id', params.tenantId)
        .maybeSingle()

      if (configError) throw new Error(`No se pudo cargar configuración fiscal: ${configError.message}`)
      if (!config) {
        warning = await buildMissingFiscalConfigWarning(supabase, params.tenantId)
        console.error('[cerrarCuentaMesa] tenant sin configuración fiscal', {
          tenantId: params.tenantId,
          mesaId: params.mesaId,
          pedidoId: pedido.id,
        })
      } else {
        let clienteFacturaId: string | null = null
        let receptorNombre: string | null = null
        let receptorRuc: string | null = null
        let receptorCi: string | null = null

        if (pedido.cliente_id) {
          const { data: cliente, error: clienteError } = await supabase
            .from('clientes')
            .select('id, nombre, ci, ruc')
            .eq('tenant_id', params.tenantId)
            .eq('id', pedido.cliente_id)
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

        const siguiente = (config.ultimo_numero ?? 0) + 1
        const numeroFactura = `${config.establecimiento}-${config.punto_expedicion}-${String(siguiente).padStart(7, '0')}`
        const total = Number(pedido.total ?? 0)
        const totalIva10 = Math.round((total / 1.1) * 0.1 * 100) / 100
        const totalExento = Math.round((total - totalIva10) * 100) / 100

        const { error: facturaInsertError } = await supabase.from('facturas').insert({
          tenant_id: params.tenantId,
          pedido_id: pedido.id,
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
        })

        if (facturaInsertError) throw new Error(`No se pudo emitir la factura al cerrar cuenta: ${facturaInsertError.message}`)

        const { error: updateConfigError } = await supabase
          .from('tenant_facturacion')
          .update({ ultimo_numero: siguiente, updated_at: new Date().toISOString() })
          .eq('tenant_id', params.tenantId)

        if (updateConfigError) {
          throw new Error(`No se pudo actualizar la numeración fiscal: ${updateConfigError.message}`)
        }

        facturaEmitidaAhora = true
      }
    }

    if (facturaYaExistia || facturaEmitidaAhora) {
      try {
        mensajeImpresion = await requestAgentPrint(pedido.id, 'factura', params.tenantId)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo encolar la impresión de factura.'
        warning = warning ? `${warning} ${message}` : message
      }
    }

    const { error: liberarError } = await supabase.rpc('liberar_mesa', {
      p_tenant_id: params.tenantId,
      p_mesa_id: params.mesaId,
      p_usuario_id: params.usuarioId ?? null,
      p_pedido_id: pedido.id,
    })

    if (liberarError) throw new Error(`Se emitió/encoló impresión, pero no se pudo liberar la mesa: ${liberarError.message}`)

    return {
      pedidoId: pedido.id,
      numeroPedido: Number(pedido.numero_pedido),
      facturaEmitidaAhora,
      facturaYaExistia,
      mensajeImpresion,
      warning,
    }
  },
}
