import { supabase } from '../supabase'
import type { 
  Pedido, 
  NuevoPedido, 
  PedidoCompleto,
  ItemPedido,
  NuevoItemPedido 
} from '@/types/supabase'

const PEDIDO_SELECT_FIELDS = `
  id,
  tenant_id,
  numero_pedido,
  pedido_ciclo,
  cliente_id,
  usuario_id,
  tipo,
  estado,
  total,
  puntos_generados,
  notas,
  created_at,
  updated_at,
  estado_pedido,
  empleado_id,
  cancelado_por_id,
  cancelado_at,
  motivo_cancelacion
`

const ITEM_PEDIDO_SELECT_FIELDS = `
  id,
  pedido_id,
  producto_id,
  producto_nombre,
  cantidad,
  precio_unitario,
  subtotal,
  notas,
  created_at,
  iva_porcentaje,
  monto_iva,
  personalizaciones,
  orden_ticket
`

/**
 * Crear un nuevo pedido completo con sus items
 */
export async function crearPedido(
  datosPedido: NuevoPedido,
  items: NuevoItemPedido[]
) {
  // Iniciar transacción: crear pedido
  const { data: pedido, error: errorPedido } = await supabase
    .from('pedidos')
    .insert(datosPedido)
    .select(PEDIDO_SELECT_FIELDS)
    .single()
  
  if (errorPedido) throw errorPedido
  
  // Agregar items al pedido
  const itemsConPedidoId = items.map(item => ({
    ...item,
    pedido_id: pedido.id
  }))
  
  const { error: errorItems } = await supabase
    .from('items_pedido')
    .insert(itemsConPedidoId)
  
  if (errorItems) throw errorItems
  
  return pedido as Pedido
}

/**
 * Obtener pedidos activos (para KDS)
 */
export async function getPedidosActivos() {
  const { data, error } = await supabase
    .from('vista_pedidos_completos')
    .select('*')
    .in('estado', ['pendiente', 'en_preparacion'])
    .order('fecha_creacion', { ascending: true })
  
  if (error) throw error
  return data as PedidoCompleto[]
}

/**
 * Obtener pedidos por estado
 */
export async function getPedidosPorEstado(
  estado: 'pendiente' | 'en_preparacion' | 'listo' | 'entregado' | 'cancelado'
) {
  const { data, error } = await supabase
    .from('pedidos')
    .select(PEDIDO_SELECT_FIELDS)
    .eq('estado', estado)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data as Pedido[]
}

/**
 * Obtener un pedido completo por ID
 */
export async function getPedidoPorId(id: string) {
  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      ${PEDIDO_SELECT_FIELDS},
      items_pedido(${ITEM_PEDIDO_SELECT_FIELDS}),
      clientes(
        id,
        tenant_id,
        nombre,
        ci,
        telefono,
        email,
        direccion,
        puntos_totales,
        notas,
        created_at,
        updated_at,
        ruc,
        pasaporte,
        fecha_nacimiento
      )
    `)
    .eq('id', id)
    .single()
  
  if (error) throw error
  return data
}

/**
 * Obtener items de un pedido
 */
export async function getItemsPedido(pedidoId: string) {
  const { data, error } = await supabase
    .from('items_pedido')
    .select(ITEM_PEDIDO_SELECT_FIELDS)
    .eq('pedido_id', pedidoId)
  
  if (error) throw error
  return data as ItemPedido[]
}

/**
 * Actualizar estado de un pedido
 */
export async function actualizarEstadoPedido(
  pedidoId: string,
  nuevoEstado: 'pendiente' | 'en_preparacion' | 'listo' | 'entregado' | 'cancelado'
) {
  const updates: Partial<Pedido> = {
    estado: nuevoEstado,
    updated_at: new Date().toISOString()
  }
  
  // Nota: La fecha de entrega se maneja automáticamente por triggers en la BD
  
  const { data, error } = await supabase
    .from('pedidos')
    .update(updates)
    .eq('id', pedidoId)
    .select(PEDIDO_SELECT_FIELDS)
    .single()
  
  if (error) throw error
  return data as Pedido
}

/**
 * Obtener pedidos del día
 */
export async function getPedidosDelDia() {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  
  const { data, error } = await supabase
    .from('pedidos')
    .select(PEDIDO_SELECT_FIELDS)
    .gte('fecha_creacion', hoy.toISOString())
    .order('fecha_creacion', { ascending: false })
  
  if (error) throw error
  return data as Pedido[]
}

/**
 * Obtener estadísticas del día
 */
export async function getEstadisticasDelDia() {
  const pedidos = await getPedidosDelDia()
  
  const totalPedidos = pedidos.length
  const totalVentas = pedidos.reduce((sum, p) => sum + parseFloat(p.total.toString()), 0)
  const pedidosPendientes = pedidos.filter(p => p.estado === 'pendiente').length
  const pedidosCompletados = pedidos.filter(p => p.estado === 'entregado').length
  
  return {
    totalPedidos,
    totalVentas,
    pedidosPendientes,
    pedidosCompletados,
    porTipo: {
      delivery: pedidos.filter(p => p.tipo === 'delivery').length,
      local: pedidos.filter(p => p.tipo === 'local').length,
      para_llevar: pedidos.filter(p => p.tipo === 'para_llevar').length,
    }
  }
}

/**
 * Cancelar un pedido
 */
export async function cancelarPedido(pedidoId: string, motivo?: string) {
  const updates: Partial<Pedido> = {
    estado: 'cancelado',
    notas: motivo || 'Pedido cancelado'
  }
  
  return actualizarEstadoPedido(pedidoId, 'cancelado')
}

/**
 * Suscribirse a cambios en pedidos (para Realtime)
 */
export function suscribirseAPedidos(
  callback: (payload: any) => void
) {
  const channel = supabase
    .channel('pedidos-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'pedidos'
      },
      callback
    )
    .subscribe()
  
  return channel
}

/**
 * Desuscribirse de cambios
 */
export async function desuscribirseDePedidos(channel: any) {
  await supabase.removeChannel(channel)
}

