import { createClient } from '@/lib/supabase/client'
import type { PostgrestError } from '@supabase/supabase-js'
import { descontarIngredientesPorPedido } from '@/lib/inventory/consumption'
import type { CartItem } from '@/store/cartStore'
import type { Cliente } from '@/types/supabase'
import type { TipoPedido, FeedbackDetail } from '../types/pos.types'
import {
  calcularPuntosAutomaticos,
  normalizePuntosRetornoPct,
  formatTipoPedido,
  formatItemModificacionesForTicket,
  clienteTieneRucParaFactura,
  RECEPTOR_FACTURA_GENERICO_NOMBRE,
  RECEPTOR_FACTURA_GENERICO_RUC,
  RECEPTOR_FACTURA_GENERICO_CI,
  type PuntosRetornoPct,
} from '../utils/pos.utils'
import { formatGuaranies } from '@/lib/utils/format'
import { printService } from './printService'
import { registrarCanjePuntos, registrarPuntosGanados } from '@/lib/db/puntos'
import { requestAgentPrint } from '@/features/impresion/agentPrintClient'
import { getPrinterCopiasConfig } from '@/features/impresion/printerCopias'

/** Convierte error de Supabase en Error con mensaje legible para el usuario y la consola */
function toError(err: PostgrestError | Error, context: string): Error {
  if (err instanceof Error) return err
  const e = err as PostgrestError
  const msg = e?.message ?? 'Error desconocido'
  const detail = e?.details != null ? ` (${e.details})` : ''
  return new Error(`${context}: ${msg}${detail}`)
}

interface ConfirmOrderParams {
  tenantId: string
  usuarioId: string
  tenantNombre: string
  usuarioNombre: string
  cliente: Cliente | null
  tipo: TipoPedido
  items: CartItem[]
  total: number
  /** Ventas: true. Canje: false (solo ticket cocina). */
  emitirFactura?: boolean
  /** Modal “¿Desea factura?” Sí: factura a nombre del cliente (RUC si existe; si no, nombre+CI). */
  facturaALNombreDelCliente: boolean
  /**
   * Modal “No”: comprobante genérico Nombre “Cliente” / RUC “0” (false) o nombre+CI del cliente (true).
   * Ignorado si `facturaALNombreDelCliente` es true.
   */
  facturaMostrarNombreYCI?: boolean
  /** % entero (1, 5 o 10) de retorno en puntos sobre el total cobrado. */
  puntosRetornoPct: PuntosRetornoPct
  /** Si viene, el pedido se vincula a una mesa del salón. */
  mesaId?: string | null
}

export const orderService = {
  async confirmOrder(params: ConfirmOrderParams) {
    const supabase = createClient()
    const {
      tenantId,
      usuarioId,
      tenantNombre,
      usuarioNombre,
      cliente,
      tipo,
      items,
      total,
      emitirFactura = true,
      facturaALNombreDelCliente,
      facturaMostrarNombreYCI = false,
      puntosRetornoPct,
      mesaId = null,
    } = params
    let mesaNumero: number | null = null

    const retornoPct = normalizePuntosRetornoPct(puntosRetornoPct)

    if (!tipo) {
      throw new Error('El tipo de pedido es requerido')
    }

    if (items.length === 0) {
      throw new Error('El carrito está vacío')
    }

    if (mesaId) {
      const { data: mesa, error: mesaError } = await supabase
        .from('mesas')
        .select('id, numero, estado, activa')
        .eq('tenant_id', tenantId)
        .eq('id', mesaId)
        .maybeSingle()

      if (mesaError) throw toError(mesaError, 'Error al validar la mesa del pedido')
      if (!mesa) throw new Error('La mesa seleccionada no existe en este local')
      if (!mesa.activa) throw new Error('La mesa seleccionada está inactiva')
      if (mesa.estado === 'bloqueada') {
        throw new Error('La mesa está bloqueada. Elegí otra mesa o desbloqueala.')
      }
      mesaNumero = Number(mesa.numero)
    }

    // Orden de impresión/cocina:
    // 1) Mantener el orden de selección original para productos
    // 2) Dejar las salsas (grupo='salsa') al final
    const itemsOrdenados = items
      .map((item, idx) => ({ item, idx }))
      .sort((a, b) => {
        const aIsSauce = a.item.grupo === 'salsa'
        const bIsSauce = b.item.grupo === 'salsa'
        if (aIsSauce !== bIsSauce) return aIsSauce ? 1 : -1
        return a.idx - b.idx
      })
      .map(({ item }) => item)

    const puntosAuto = calcularPuntosAutomaticos(total, retornoPct)
    const puntosBonus = items.reduce(
      (sum, item) => (item.is_manual ? sum : sum + ((item.puntos_extra ?? 0) * item.cantidad)),
      0
    )
    const puntosGenerados = puntosAuto + puntosBonus

    const canjeItems = items.filter((i) => i.modo === 'canje' && i.tipo === 'producto')
    const puntosCosteCanje = canjeItems.reduce((sum, item) => sum + ((item.puntos_canje ?? 0) * item.cantidad), 0)

    if (canjeItems.length > 0) {
      if (!cliente) {
        throw new Error('Se requiere un cliente para canjear puntos')
      }
      if (puntosCosteCanje <= 0) {
        throw new Error('El canje debe tener puntos asociados')
      }
      if (puntosCosteCanje > cliente.puntos_totales) {
        throw new Error('El cliente no tiene suficientes puntos para el canje')
      }
    }

    // Crear pedido en EDIT: impresión/cocina vía Realtime solo tras UPDATE a FACT al final
    // (ítems + customización + factura ya persistidos; evita carrera con vista_items_ticket_cocina).
    const { data: pedido, error: errorPedido } = await supabase
      .from('pedidos')
      .insert({
        tenant_id: tenantId,
        cliente_id: cliente?.id || null,
        usuario_id: usuarioId,
        mesa_id: mesaId,
        tipo,
        total,
        puntos_generados: cliente ? puntosGenerados : 0,
        // Crear primero en EDIT para completar items/customizaciones antes
        // de disparar la impresión automática (FACT).
        estado_pedido: 'EDIT'
      })
      .select()
      .single()

    if (errorPedido) throw toError(errorPedido, 'Error al crear el pedido')

    // Insertar items del pedido (notas = texto de modificaciones para el ticket de cocina)
    const itemsToInsert = itemsOrdenados.map((item, idx) => ({
      pedido_id: pedido.id,
      producto_id: item.is_manual ? null : item.producto_id,
      producto_nombre:
        item.modo === 'canje' && item.tipo === 'producto'
          ? `CANJE: ${item.nombre}`
          : item.nombre,
      cantidad: item.cantidad,
      // En canje el total se cobra con puntos, por eso evitamos mostrar precios en tickets (manteniendo total=0).
      precio_unitario: item.modo === 'canje' && item.tipo === 'producto' ? 0 : item.precio,
      subtotal: item.subtotal,
      orden_ticket: idx + 1,
      notas: (() => {
        const baseNotas = formatItemModificacionesForTicket(item)
        if (!(item.modo === 'canje' && item.tipo === 'producto')) return baseNotas ?? null

        const puntosLinea = (item.puntos_canje ?? 0) * item.cantidad
        const canjeNota =
          puntosLinea > 0 ? `CANJE DE PUNTOS (${puntosLinea} pts)` : 'CANJE DE PUNTOS'

        return baseNotas ? `${baseNotas} · ${canjeNota}` : canjeNota
      })()
    }))

    const { data: itemsInsertados, error: errorItems } = await supabase
      .from('items_pedido')
      .insert(itemsToInsert)
      .select()

    if (errorItems) throw toError(errorItems, 'Error al guardar los ítems del pedido')

    // Mapear los CartItems con sus IDs reales de items_pedido para la customización
    const cartItemsConId = itemsOrdenados.map((item, index) => ({
      ...item,
      id: itemsInsertados?.[index]?.id || item.id
    }))

    // Canje de puntos: descontar solo el costo solicitado antes de acreditar puntos ganados
    let puntosSaldoConsumidos = 0
    if (cliente && canjeItems.length > 0) {
      puntosSaldoConsumidos = puntosCosteCanje
      await registrarCanjePuntos(
        tenantId,
        cliente.id,
        puntosSaldoConsumidos,
        pedido.id,
        `Canje de puntos: costo ${puntosCosteCanje} pts`
      )
    }

    // Acreditar puntos generados por la venta (solo sobre productos de venta)
    if (cliente && puntosGenerados > 0) {
      await registrarPuntosGanados(
        tenantId,
        cliente.id,
        puntosGenerados,
        pedido.id,
        `Puntos ganados por pedido #${pedido.numero_pedido}`
      )
    }

    // Descontar ingredientes o inventario según tipo de producto
    const resultadoInventario = await descontarIngredientesPorPedido({
      tenantId,
      items: cartItemsConId,
      pedidoId: pedido.id,
      pedidoNumero: pedido.numero_pedido,
      usuarioId
    }).catch((consumptionError) => {
      console.warn('Error al descontar inventario:', consumptionError)
      return { success: false, errores: ['Error al procesar inventario'] }
    })

    // Si hubo errores de stock, registrar advertencia
    if (!resultadoInventario.success && resultadoInventario.errores.length > 0) {
      console.warn('Advertencias de inventario:', resultadoInventario.errores)
      // El pedido ya fue creado, solo notificamos los errores
    }

    let facturaEmitida = false
    if (emitirFactura) {
      try {
        const { data: config } = await supabase
          .from('tenant_facturacion')
          .select('timbrado, establecimiento, punto_expedicion, ultimo_numero')
          .eq('tenant_id', tenantId)
          .maybeSingle()

        if (config) {
          const siguiente = (config.ultimo_numero ?? 0) + 1
          const numeroFactura = `${config.establecimiento}-${config.punto_expedicion}-${String(siguiente).padStart(7, '0')}`

          const totalIva10 = Math.round((total / 1.1) * 0.1 * 100) / 100
          const totalExento = Math.round((total - totalIva10) * 100) / 100

          const tieneRuc = clienteTieneRucParaFactura(cliente)
          let clienteIdFactura: string | null = null
          let receptor_nombre_impresion: string | null = null
          let receptor_ruc_impresion: string | null = null
          let receptor_ci_impresion: string | null = null

          if (facturaALNombreDelCliente) {
            if (cliente && tieneRuc) {
              clienteIdFactura = cliente.id
            } else if (cliente) {
              receptor_nombre_impresion = cliente.nombre?.trim() || RECEPTOR_FACTURA_GENERICO_NOMBRE
              receptor_ci_impresion = cliente.ci?.trim() || RECEPTOR_FACTURA_GENERICO_CI
            } else {
              receptor_nombre_impresion = RECEPTOR_FACTURA_GENERICO_NOMBRE
              receptor_ruc_impresion = RECEPTOR_FACTURA_GENERICO_RUC
              receptor_ci_impresion = null
            }
          } else if (facturaMostrarNombreYCI && cliente) {
            receptor_nombre_impresion = cliente.nombre?.trim() || RECEPTOR_FACTURA_GENERICO_NOMBRE
            receptor_ci_impresion = cliente.ci?.trim() || RECEPTOR_FACTURA_GENERICO_CI
          } else {
            receptor_nombre_impresion = RECEPTOR_FACTURA_GENERICO_NOMBRE
            receptor_ruc_impresion = RECEPTOR_FACTURA_GENERICO_RUC
            receptor_ci_impresion = null
          }

          const { error: errFactura } = await supabase.from('facturas').insert({
            tenant_id: tenantId,
            pedido_id: pedido.id,
            numero_factura: numeroFactura,
            timbrado: config.timbrado,
            cliente_id: clienteIdFactura,
            receptor_nombre_impresion,
            receptor_ruc_impresion,
            receptor_ci_impresion,
            total,
            total_iva_10: totalIva10,
            total_iva_5: 0,
            total_exento: totalExento,
          })

          if (!errFactura) {
            facturaEmitida = true
            await supabase
              .from('tenant_facturacion')
              .update({ ultimo_numero: siguiente, updated_at: new Date().toISOString() })
              .eq('tenant_id', tenantId)
          }
        }
      } catch (facturaErr) {
        console.warn('No se pudo emitir factura (config puede no existir):', facturaErr)
      }
    }

    // Confirmar recién al final para que el agente Realtime lea el pedido
    // con items y customizaciones ya persistidos.
    const { error: errorConfirmacion } = await supabase
      .from('pedidos')
      .update({
        estado_pedido: 'FACT',
        updated_at: new Date().toISOString()
      })
      .eq('id', pedido.id)
      .eq('tenant_id', tenantId)

    if (errorConfirmacion) throw toError(errorConfirmacion, 'Error al confirmar el pedido para impresión')

    // Doble ticket cocina: el agente ya imprime 1× al pasar a FACT; encolamos 1× más (misma cola que Reimprimir).
    const copiasCfg = await getPrinterCopiasConfig(supabase, tenantId)
    if (copiasCfg.copias_ticket_cocina === 2) {
      setTimeout(() => {
        requestAgentPrint(pedido.id, 'cocina', tenantId).catch((e) => {
          console.warn('[confirmOrder] segunda copia cocina (reprint_solicitud):', e)
        })
      }, 450)
    }

    if (mesaId) {
      const { error: mesaOcupadaError } = await supabase
        .from('mesas')
        .update({
          estado: 'ocupada',
          updated_at: new Date().toISOString()
        })
        .eq('tenant_id', tenantId)
        .eq('id', mesaId)

      if (mesaOcupadaError) {
        throw toError(mesaOcupadaError, 'Error al marcar la mesa como ocupada')
      }

      await supabase.from('mesa_eventos').insert({
        tenant_id: tenantId,
        mesa_id: mesaId,
        pedido_id: pedido.id,
        usuario_id: usuarioId,
        tipo: 'ocupar_mesa',
        payload: { source: 'confirmOrder' }
      })
    }
    
    const pedidoFacturado = { ...pedido, estado_pedido: 'FACT' as const }

    // Imprimir ticket de cocina (no crítico - si falla, el pedido se guarda igual)
    printService
      .printKitchenTicket(tenantId, pedidoFacturado, itemsOrdenados, tenantNombre)
      .catch((printError) => {
        console.warn('No se pudo imprimir el ticket de cocina', printError)
      })

    // Construir detalles del feedback
    const successDetails: FeedbackDetail[] = [
      { label: 'Local', value: tenantNombre },
      { label: 'Cajero', value: usuarioNombre },
      { label: 'Tipo', value: formatTipoPedido(tipo) },
      { label: 'Total cobrado', value: formatGuaranies(total) }
    ]

    if (mesaId) {
      successDetails.push({
        label: 'Mesa',
        value: mesaNumero && Number.isFinite(mesaNumero) ? `#${mesaNumero}` : 'Mesa asignada'
      })
    }

    if (cliente) {
      successDetails.push({ label: 'Cliente', value: cliente.nombre })
    }

    if (canjeItems.length > 0 && cliente) {
      const nombreCanjeado = canjeItems[0]?.nombre ?? '—'
      successDetails.push({
        label: 'Puntos canjeados',
        value: `${puntosSaldoConsumidos} pts`
      })
      successDetails.push({ label: 'Producto canjeado', value: nombreCanjeado })
    }

    if (cliente && puntosGenerados > 0) {
      successDetails.push({ label: 'Puntos sumados', value: `${puntosGenerados} ⭐` })
    }

    if (canjeItems.length > 0) {
      successDetails.push({ label: 'Factura', value: 'No emitida (canje — solo cocina)' })
    } else if (facturaEmitida) {
      successDetails.push({ label: 'Factura', value: 'Emitida' })
    }

    return {
      pedido: pedidoFacturado,
      successDetails
    }
  }
}
