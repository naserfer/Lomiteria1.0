import { supabase } from '@/core/supabase'
import type { Producto } from '@/shared/types/supabase'

// Tipos auxiliares para el archivo
type ProductoCompleto = Producto & { categoria_nombre?: string }
type NuevoProducto = Omit<Producto, 'id'>

/**
 * Obtener todos los productos disponibles
 */
export async function getProductos() {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('disponible', true)
    .eq('is_deleted', false)
    .order('nombre')
  
  if (error) throw error
  return data
}

/**
 * Obtener productos con información de categoría
 */
export async function getProductosCompletos() {
  const { data, error } = await supabase
    .from('vista_productos_completos')
    .select('*')
  
  if (error) throw error
  return data as ProductoCompleto[]
}

/**
 * Obtener productos por categoría
 */
export async function getProductosPorCategoria(categoriaId: string) {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('categoria_id', categoriaId)
    .eq('disponible', true)
    .eq('is_deleted', false)
    .order('nombre')
  
  if (error) throw error
  return data as Producto[]
}

/**
 * Obtener un producto por ID
 */
export async function getProductoPorId(id: string) {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('id', id)
    .eq('is_deleted', false)
    .single()
  
  if (error) throw error
  return data as Producto
}

/**
 * Buscar productos por nombre
 */
export async function buscarProductos(termino: string) {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .ilike('nombre', `%${termino}%`)
    .eq('disponible', true)
    .order('nombre')
    .limit(10)
  
  if (error) throw error
  return data as Producto[]
}

/**
 * Crear un nuevo producto
 */
export async function crearProducto(producto: NuevoProducto) {
  const { data, error } = await supabase
    .from('productos')
    .insert(producto)
    .select()
    .single()
  
  if (error) throw error
  return data as Producto
}

/**
 * Actualizar un producto
 */
export async function actualizarProducto(
  id: string,
  cambios: Partial<Producto>
) {
  const { data, error } = await supabase
    .from('productos')
    .update(cambios)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data as Producto
}

/**
 * Cambiar disponibilidad de un producto
 */
export async function toggleDisponibilidadProducto(
  id: string,
  disponible: boolean
) {
  return actualizarProducto(id, { disponible })
}

/**
 * Eliminar un producto (soft delete - marcarlo como no disponible)
 */
export async function eliminarProducto(id: string) {
  return actualizarProducto(id, { disponible: false })
}

