import { supabase } from '@/core/supabase'
import type { 
  Pedido, 
  NuevoPedido, 
  PedidoCompleto,
  ItemPedido,
  NuevoItemPedido 
} from '@/shared/types/supabase'

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
    .select()
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
    .in('estado', ['pendiente', 'preparando'])
    .order('fecha_creacion', { ascending: true })
  
  if (error) throw error
  return data as PedidoCompleto[]
}

/**
 * Obtener pedidos por estado
 */
export async function getPedidosPorEstado(
  estado: 'pendiente' | 'preparando' | 'listo' | 'entregado' | 'cancelado'
) {
  const { data, error } = await supabase
    .from('pedidos')
    .select('*')
    .eq('estado', estado)
    .order('fecha_creacion', { ascending: false })
  
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
      *,
      items_pedido(*),
      clientes(*)
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
    .select('*')
    .eq('pedido_id', pedidoId)
  
  if (error) throw error
  return data as ItemPedido[]
}

/**
 * Actualizar estado de un pedido
 */
export async function actualizarEstadoPedido(
  pedidoId: string,
  nuevoEstado: 'pendiente' | 'preparando' | 'listo' | 'entregado' | 'cancelado'
) {
  const updates: Partial<Pedido> = {
    estado: nuevoEstado,
    fecha_actualizado: new Date().toISOString()
  }
  
  // Si se marca como entregado, guardar la fecha
  if (nuevoEstado === 'entregado') {
    updates.fecha_entregado = new Date().toISOString()
  }
  
  const { data, error } = await supabase
    .from('pedidos')
    .update(updates)
    .eq('id', pedidoId)
    .select()
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
    .select('*')
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
      takeaway: pedidos.filter(p => p.tipo === 'takeaway').length,
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

