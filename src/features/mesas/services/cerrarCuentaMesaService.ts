import { createClient } from '@/lib/supabase/client'
import { requestAgentPrint } from '@/features/impresion/agentPrintClient'
import { getPrinterCopiasConfig } from '@/features/impresion/printerCopias'
import {
  RECEPTOR_FACTURA_GENERICO_CI,
  RECEPTOR_FACTURA_GENERICO_NOMBRE,
  RECEPTOR_FACTURA_GENERICO_RUC,
  clienteTieneRucParaFactura,
} from '@/features/pos/utils/pos.utils'
import { broadcastMesasChanged } from './mesasRealtimeBroadcast'

interface CerrarCuentaMesaParams {
  tenantId: string
  mesaId: string
  usuarioId?: string | null
  metodoCobro?: 'tarjeta' | 'efectivo' | null
}

interface CerrarCuentaMesaResult {
  pedidoId: string
  numeroPedido: number
  facturaEmitidaAhora: boolean
  facturaYaExistia: boolean
  mensajeImpresion: string
  warning: string | null
}

const MAX_PEDIDOS_CIERRE_MESA = 12

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
      .select('id, numero, activa, updated_at')
      .eq('tenant_id', params.tenantId)
      .eq('id', params.mesaId)
      .maybeSingle()

    if (mesaError) throw new Error(`No se pudo validar la mesa: ${mesaError.message}`)
    if (!mesa) throw new Error('La mesa no existe en este local.')
    if (!mesa.activa) throw new Error('La mesa está inactiva.')

    // Cerrar solo pedidos de la sesión actual de la mesa (evita reimprimir históricos).
    // Corte de sesión: último evento de "liberar_mesa". Si no existe, no filtramos.
    const { data: ultimoEventoLiberar } = await supabase
      .from('mesa_eventos')
      .select('created_at')
      .eq('tenant_id', params.tenantId)
      .eq('mesa_id', params.mesaId)
      .eq('tipo', 'liberar_mesa')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const pedidosBaseQuery = supabase
      .from('pedidos')
      .select('id, numero_pedido, total, cliente_id, estado, estado_pedido, created_at')
      .eq('tenant_id', params.tenantId)
      .eq('mesa_id', params.mesaId)
      .eq('estado_pedido', 'FACT')
      .neq('estado', 'cancelado')

    let pedidosActivos: Array<{
      id: string
      numero_pedido: number
      total: number
      cliente_id: string | null
      estado: string
      estado_pedido: string
      created_at: string
    }> | null = null
    let pedidoError: { message: string } | null = null

    if (ultimoEventoLiberar?.created_at) {
      const { data, error } = await pedidosBaseQuery
        .gte('created_at', ultimoEventoLiberar.created_at)
        .order('created_at', { ascending: true })
      pedidosActivos = data
      pedidoError = error
    } else {
      const { data, error } = await pedidosBaseQuery.order('created_at', { ascending: true })
      pedidosActivos = data
      pedidoError = error
    }

    if (pedidoError) throw new Error(`No se pudo obtener el pedido activo de mesa: ${pedidoError.message}`)

    // Fallback: si el corte por sesión quedó demasiado estricto, usar el último FACT.
    if ((!pedidosActivos || pedidosActivos.length === 0) && ultimoEventoLiberar?.created_at) {
      const { data: ultimoPedidoFact, error: ultimoPedidoFactError } = await pedidosBaseQuery
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (ultimoPedidoFactError) {
        throw new Error(`No se pudo obtener pedido FACT de respaldo: ${ultimoPedidoFactError.message}`)
      }
      pedidosActivos = ultimoPedidoFact ? [ultimoPedidoFact] : []
    }

    if (!pedidosActivos || pedidosActivos.length === 0) {
      throw new Error('No hay pedidos FACT para cerrar en esta mesa.')
    }
    if (pedidosActivos.length > MAX_PEDIDOS_CIERRE_MESA) {
      throw new Error(
        `Se detectaron ${pedidosActivos.length} pedidos FACT para esta mesa (límite ${MAX_PEDIDOS_CIERRE_MESA}). ` +
        'Se detuvo el cierre para evitar reimpresiones masivas. Revisá pedidos históricos vinculados a la mesa.'
      )
    }

    let pedidoPrincipal = pedidosActivos[pedidosActivos.length - 1]

    // Consolidar sesión de mesa en un solo pedido FACT para emitir/imprimir UNA sola factura.
    if (pedidosActivos.length > 1) {
      const secundarios = pedidosActivos.filter((p) => p.id !== pedidoPrincipal.id)
      const secundariosIds = secundarios.map((p) => p.id)

      // 1) Mover todos los items de pedidos secundarios al principal.
      const { error: moveItemsError } = await supabase
        .from('items_pedido')
        .update({ pedido_id: pedidoPrincipal.id })
        .in('pedido_id', secundariosIds)
      if (moveItemsError) {
        throw new Error(`No se pudo consolidar items en el pedido principal: ${moveItemsError.message}`)
      }

      // 2) Recalcular total del principal con los subtotales reales de items (incluye extras/notas).
      const { data: itemsConsolidados, error: totalConsolidadoError } = await supabase
        .from('items_pedido')
        .select('subtotal')
        .eq('pedido_id', pedidoPrincipal.id)
      if (totalConsolidadoError) {
        throw new Error(`No se pudo recalcular total consolidado: ${totalConsolidadoError.message}`)
      }
      const totalConsolidado = (itemsConsolidados ?? []).reduce(
        (sum, row) => sum + Number(row.subtotal ?? 0),
        0
      )

      const nowIso = new Date().toISOString()
      const { error: updatePrincipalError } = await supabase
        .from('pedidos')
        .update({ total: totalConsolidado, updated_at: nowIso })
        .eq('id', pedidoPrincipal.id)
        .eq('tenant_id', params.tenantId)
      if (updatePrincipalError) {
        throw new Error(`No se pudo actualizar total consolidado del pedido principal: ${updatePrincipalError.message}`)
      }

      // 3) Marcar secundarios como ANUL/cancelado para no duplicar facturación/impresión.
      const { error: cancelSecError } = await supabase
        .from('pedidos')
        .update({ estado: 'cancelado', estado_pedido: 'ANUL', total: 0, updated_at: nowIso })
        .in('id', secundariosIds)
        .eq('tenant_id', params.tenantId)
      if (cancelSecError) {
        throw new Error(`No se pudieron cerrar pedidos secundarios en la consolidación: ${cancelSecError.message}`)
      }

      pedidoPrincipal = { ...pedidoPrincipal, total: totalConsolidado }
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
      .eq('anulada', false)
      .maybeSingle()

    if (facturaExistenteError?.message?.toLowerCase().includes('metodo_cobro')) {
      metodoCobroDisponible = false
      const fallback = await supabase
        .from('facturas')
        .select('id')
        .eq('tenant_id', params.tenantId)
        .eq('pedido_id', pedidoPrincipal.id)
        .eq('anulada', false)
        .maybeSingle()
      facturaExistente = fallback.data
        ? { id: fallback.data.id, metodo_cobro: null }
        : null
      facturaExistenteError = fallback.error
    }

    if (facturaExistenteError) {
      throw new Error(`No se pudo verificar la factura del pedido consolidado #${pedidoPrincipal.numero_pedido}: ${facturaExistenteError.message}`)
    }

    facturaYaExistia = Boolean(facturaExistente?.id)

    // Si la factura ya existe pero no tenía método, completar al cerrar cuenta.
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
        console.error('[cerrarCuentaMesa] tenant sin configuración fiscal', {
          tenantId: params.tenantId,
          mesaId: params.mesaId,
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

        // Compatibilidad temporal: si la columna aún no existe en BD, insertar sin método.
        if (facturaInsertError?.message?.toLowerCase().includes('metodo_cobro')) {
          metodoCobroDisponible = false
          const fallback = await supabase.from('facturas').insert(facturaPayload)
          facturaInsertError = fallback.error
        }

        if (facturaInsertError) throw new Error(`No se pudo emitir la factura consolidada: ${facturaInsertError.message}`)

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

    const { error: liberarError } = await supabase.rpc('liberar_mesa', {
      p_tenant_id: params.tenantId,
      p_mesa_id: params.mesaId,
      p_usuario_id: params.usuarioId ?? null,
      p_pedido_id: pedidoPrincipal.id,
    })

    if (liberarError) throw new Error(`Se emitió/encoló impresión, pero no se pudo liberar la mesa: ${liberarError.message}`)

    void broadcastMesasChanged(params.tenantId, 'cerrarCuenta:liberar')

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
