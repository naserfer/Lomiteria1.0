import { supabase } from '@/core/supabase'
import type { Categoria } from '@/shared/types/supabase'

/**
 * Obtener todas las categorías activas ordenadas
 */
export async function getCategorias() {
  const { data, error } = await supabase
    .from('categorias')
    .select('*')
    .eq('activa', true)
    .order('orden')
  
  if (error) throw error
  return data as Categoria[]
}

/**
 * Obtener una categoría por ID
 */
export async function getCategoriaPorId(id: string) {
  const { data, error } = await supabase
    .from('categorias')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) throw error
  return data as Categoria
}

/**
 * Obtener categorías con conteo de productos
 */
export async function getCategoriasConProductos() {
  const { data, error } = await supabase
    .from('categorias')
    .select(`
      *,
      productos:productos(count)
    `)
    .eq('activa', true)
    .order('orden')
  
  if (error) throw error
  return data
}

/**
 * Crear una nueva categoría
 */
export async function crearCategoria(
  nombre: string,
  descripcion?: string,
  orden?: number
) {
  const { data, error } = await supabase
    .from('categorias')
    .insert({ nombre, descripcion, orden })
    .select()
    .single()
  
  if (error) throw error
  return data as Categoria
}

/**
 * Actualizar una categoría
 */
export async function actualizarCategoria(
  id: string,
  cambios: Partial<Categoria>
) {
  const { data, error } = await supabase
    .from('categorias')
    .update(cambios)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data as Categoria
}

/**
 * Cambiar orden de categorías
 */
export async function reordenarCategorias(
  categoriasOrdenadas: { id: string; orden: number }[]
) {
  const updates = categoriasOrdenadas.map(({ id, orden }) =>
    supabase
      .from('categorias')
      .update({ orden })
      .eq('id', id)
  )
  
  const results = await Promise.all(updates)
  const errors = results.filter(r => r.error)
  
  if (errors.length > 0) {
    throw errors[0].error
  }
  
  return true
}

