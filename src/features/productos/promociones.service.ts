import { supabase } from '@/core/supabase'
import type { Promocion } from '@/shared/types/supabase'

/**
 * Obtener promociones activas
 */
export async function getPromocionesActivas() {
  const hoy = new Date().toISOString().split('T')[0]
  
  const { data, error } = await supabase
    .from('promociones')
    .select('*')
    .eq('activa', true)
    .or(`fecha_inicio.is.null,fecha_inicio.lte.${hoy}`)
    .or(`fecha_fin.is.null,fecha_fin.gte.${hoy}`)
  
  if (error) throw error
  return data as Promocion[]
}

/**
 * Obtener promoción válida para hoy
 */
export async function getPromocionDelDia() {
  const hoy = new Date()
  const diaSemana = hoy.getDay() // 0 = domingo, 1 = lunes, etc.
  const fechaHoy = hoy.toISOString().split('T')[0]
  
  const { data, error } = await supabase
    .from('promociones')
    .select('*')
    .eq('activa', true)
    .contains('dias_semana', [diaSemana])
    .or(`fecha_inicio.is.null,fecha_inicio.lte.${fechaHoy}`)
    .or(`fecha_fin.is.null,fecha_fin.gte.${fechaHoy}`)
    .order('multiplicador', { ascending: false })
    .limit(1)
  
  if (error) throw error
  return data[0] as Promocion | null
}

/**
 * Obtener todas las promociones (admin)
 */
export async function getTodasLasPromociones() {
  const { data, error } = await supabase
    .from('promociones')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data as Promocion[]
}

/**
 * Crear una nueva promoción
 */
export async function crearPromocion(promocion: {
  nombre: string
  descripcion?: string
  tipo: 'puntos' | 'descuento' | 'regalo'
  multiplicador?: number
  descuento_porcentaje?: number
  dias_semana?: number[]
  fecha_inicio?: string
  fecha_fin?: string
}) {
  const { data, error } = await supabase
    .from('promociones')
    .insert(promocion)
    .select()
    .single()
  
  if (error) throw error
  return data as Promocion
}

/**
 * Actualizar una promoción
 */
export async function actualizarPromocion(
  id: string,
  cambios: Partial<Promocion>
) {
  const { data, error } = await supabase
    .from('promociones')
    .update(cambios)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data as Promocion
}

/**
 * Activar/Desactivar promoción
 */
export async function togglePromocion(id: string, activa: boolean) {
  return actualizarPromocion(id, { activa })
}

/**
 * Eliminar una promoción
 */
export async function eliminarPromocion(id: string) {
  const { error } = await supabase
    .from('promociones')
    .delete()
    .eq('id', id)
  
  if (error) throw error
  return true
}

