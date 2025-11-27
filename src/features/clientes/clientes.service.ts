import { supabase } from '@/core/supabase'
import type { Cliente, NuevoCliente, TopCliente } from '@/shared/types/supabase'

/**
 * Buscar cliente por teléfono (filtrado por tenant)
 */
export async function buscarClientePorTelefono(telefono: string, tenantId: string) {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('telefono', telefono)
    .eq('tenant_id', tenantId)
    .eq('is_deleted', false)
    .single()
  
  if (error) {
    if (error.code === 'PGRST116') {
      // No se encontró el cliente
      return null
    }
    throw error
  }
  
  return data as Cliente
}

/**
 * Buscar clientes por nombre, CI o teléfono (filtrado por tenant)
 */
export async function buscarClientes(termino: string, tenantId: string) {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_deleted', false)
    .or(`nombre.ilike.%${termino}%,telefono.ilike.%${termino}%,ci.ilike.%${termino}%`)
    .order('nombre')
    .limit(20)
  
  if (error) throw error
  return data as Cliente[]
}

/**
 * Obtener todos los clientes de un tenant
 */
export async function getClientesPorTenant(tenantId: string, limite: number = 100) {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_deleted', false)
    .order('nombre')
    .limit(limite)
  
  if (error) throw error
  return data as Cliente[]
}

/**
 * Obtener cliente por ID
 */
export async function getClientePorId(id: string) {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', id)
    .eq('is_deleted', false)
    .single()
  
  if (error) throw error
  return data as Cliente
}

/**
 * Crear un nuevo cliente
 */
export async function crearCliente(cliente: NuevoCliente) {
  const { data, error } = await supabase
    .from('clientes')
    .insert(cliente)
    .select()
    .single()
  
  if (error) throw error
  return data as Cliente
}

/**
 * Actualizar un cliente existente
 */
export async function actualizarCliente(clienteId: string, datos: Partial<Cliente>) {
  const { data, error } = await supabase
    .from('clientes')
    .update(datos)
    .eq('id', clienteId)
    .select()
    .single()
  
  if (error) throw error
  return data as Cliente
}

/**
 * Actualizar puntos de un cliente
 */
export async function actualizarPuntosCliente(
  clienteId: string,
  puntos: number
) {
  const { data, error } = await supabase
    .from('clientes')
    .update({ puntos_totales: puntos })
    .eq('id', clienteId)
    .select()
    .single()
  
  if (error) throw error
  return data as Cliente
}

/**
 * Sumar puntos a un cliente
 */
export async function sumarPuntos(clienteId: string, puntosASumar: number) {
  // Obtener puntos actuales
  const cliente = await getClientePorId(clienteId)
  const nuevosPuntos = cliente.puntos_totales + puntosASumar
  
  return actualizarPuntosCliente(clienteId, nuevosPuntos)
}

/**
 * Restar puntos a un cliente (para canjes)
 */
export async function restarPuntos(clienteId: string, puntosARestar: number) {
  // Obtener puntos actuales
  const cliente = await getClientePorId(clienteId)
  const nuevosPuntos = Math.max(0, cliente.puntos_totales - puntosARestar)
  
  return actualizarPuntosCliente(clienteId, nuevosPuntos)
}

/**
 * Obtener top clientes (vista)
 */
export async function getTopClientes(limite: number = 10) {
  const { data, error } = await supabase
    .from('vista_top_clientes')
    .select('*')
    .limit(limite)
  
  if (error) throw error
  return data as TopCliente[]
}

/**
 * Obtener historial de un cliente
 */
export async function getHistorialCliente(clienteId: string) {
  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      *,
      items_pedido(*)
    `)
    .eq('cliente_id', clienteId)
    .order('fecha_creacion', { ascending: false })
  
  if (error) throw error
  return data
}

/**
 * Actualizar última compra del cliente
 */
export async function actualizarUltimaCompra(clienteId: string) {
  const { data, error } = await supabase
    .from('clientes')
    .update({ ultima_compra: new Date().toISOString() })
    .eq('id', clienteId)
    .select()
    .single()
  
  if (error) throw error
  return data as Cliente
}

