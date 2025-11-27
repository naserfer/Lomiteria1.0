import { supabase } from '@/core/supabase'
import type { TransaccionPuntos } from '@/shared/types/supabase'
import { getClientePorId, actualizarPuntosCliente } from './clientes.service'

/**
 * Calcular puntos según monto usando la función de base de datos
 */
export async function calcularPuntos(monto: number, diaSemana?: number) {
  const dia = diaSemana ?? new Date().getDay()
  
  const { data, error } = await supabase.rpc('calcular_puntos', {
    monto,
    dia_semana: dia
  })
  
  if (error) {
    // Fallback: cálculo simple si la función falla
    console.warn('Error al calcular puntos con función DB:', error)
    return Math.floor(monto / 100)
  }
  
  return data
}

/**
 * Registrar ganancia de puntos
 */
export async function registrarPuntosGanados(
  clienteId: string,
  puntos: number,
  pedidoId?: string,
  descripcion?: string
) {
  // Obtener saldo actual
  const cliente = await getClientePorId(clienteId)
  const saldoAnterior = cliente.puntos_totales
  const saldoNuevo = saldoAnterior + puntos
  
  // Crear transacción
  const { data: transaccion, error } = await supabase
    .from('transacciones_puntos')
    .insert({
      cliente_id: clienteId,
      pedido_id: pedidoId,
      tipo: 'ganado',
      puntos,
      saldo_anterior: saldoAnterior,
      saldo_nuevo: saldoNuevo,
      descripcion: descripcion || `Puntos ganados por compra`
    })
    .select()
    .single()
  
  if (error) throw error
  
  // Actualizar puntos del cliente
  await actualizarPuntosCliente(clienteId, saldoNuevo)
  
  return transaccion as TransaccionPuntos
}

/**
 * Registrar canje de puntos
 */
export async function registrarCanjePuntos(
  clienteId: string,
  puntosARestar: number,
  pedidoId?: string,
  descripcion?: string
) {
  // Obtener saldo actual
  const cliente = await getClientePorId(clienteId)
  const saldoAnterior = cliente.puntos_totales
  
  // Verificar que tenga suficientes puntos
  if (saldoAnterior < puntosARestar) {
    throw new Error('El cliente no tiene suficientes puntos')
  }
  
  const saldoNuevo = saldoAnterior - puntosARestar
  
  // Crear transacción
  const { data: transaccion, error } = await supabase
    .from('transacciones_puntos')
    .insert({
      cliente_id: clienteId,
      pedido_id: pedidoId,
      tipo: 'canjeado',
      puntos: -puntosARestar, // Negativo para canje
      saldo_anterior: saldoAnterior,
      saldo_nuevo: saldoNuevo,
      descripcion: descripcion || `Canje de puntos`
    })
    .select()
    .single()
  
  if (error) throw error
  
  // Actualizar puntos del cliente
  await actualizarPuntosCliente(clienteId, saldoNuevo)
  
  return transaccion as TransaccionPuntos
}

/**
 * Ajuste manual de puntos (por admin)
 */
export async function ajustarPuntos(
  clienteId: string,
  ajuste: number,
  descripcion: string,
  usuarioResponsable?: string
) {
  // Obtener saldo actual
  const cliente = await getClientePorId(clienteId)
  const saldoAnterior = cliente.puntos_totales
  const saldoNuevo = Math.max(0, saldoAnterior + ajuste)
  
  // Crear transacción
  const { data: transaccion, error } = await supabase
    .from('transacciones_puntos')
    .insert({
      cliente_id: clienteId,
      tipo: 'ajuste',
      puntos: ajuste,
      saldo_anterior: saldoAnterior,
      saldo_nuevo: saldoNuevo,
      descripcion,
      usuario_responsable: usuarioResponsable
    })
    .select()
    .single()
  
  if (error) throw error
  
  // Actualizar puntos del cliente
  await actualizarPuntosCliente(clienteId, saldoNuevo)
  
  return transaccion as TransaccionPuntos
}

/**
 * Obtener historial de transacciones de un cliente
 */
export async function getHistorialPuntos(clienteId: string, limite: number = 50) {
  const { data, error } = await supabase
    .from('transacciones_puntos')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('fecha', { ascending: false })
    .limit(limite)
  
  if (error) throw error
  return data as TransaccionPuntos[]
}

/**
 * Obtener transacciones recientes (para admin)
 */
export async function getTransaccionesRecientes(limite: number = 20) {
  const { data, error } = await supabase
    .from('transacciones_puntos')
    .select(`
      *,
      clientes(nombre, telefono)
    `)
    .order('fecha', { ascending: false })
    .limit(limite)
  
  if (error) throw error
  return data
}

/**
 * Verificar si un cliente tiene suficientes puntos
 */
export async function verificarPuntosDisponibles(
  clienteId: string,
  puntosNecesarios: number
): Promise<boolean> {
  const cliente = await getClientePorId(clienteId)
  return cliente.puntos_totales >= puntosNecesarios
}

/**
 * Obtener resumen de puntos del cliente
 */
export async function getResumenPuntos(clienteId: string) {
  const cliente = await getClientePorId(clienteId)
  const transacciones = await getHistorialPuntos(clienteId, 10)
  
  const puntosGanados = transacciones
    .filter(t => t.tipo === 'ganado')
    .reduce((sum, t) => sum + t.puntos, 0)
  
  const puntosCanjeados = transacciones
    .filter(t => t.tipo === 'canjeado')
    .reduce((sum, t) => sum + Math.abs(t.puntos), 0)
  
  return {
    puntosActuales: cliente.puntos_totales,
    puntosGanados,
    puntosCanjeados,
    ultimasTransacciones: transacciones.slice(0, 5)
  }
}

