'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface UpdateMyTenantData {
  nombre?: string
  logo_url?: string
  direccion?: string
  telefono?: string
  email?: string
  ruc?: string
  razon_social?: string
  actividad_economica?: string
  saludo_final?: string
}

/**
 * Permite al admin del tenant actualizar los datos de su propio negocio.
 * Solo usuarios con rol 'admin' pueden llamar esta acción; actualiza únicamente el tenant del usuario en sesión.
 */
export async function updateMyTenant(data: UpdateMyTenantData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No hay sesión activa' }

  const { data: usuario, error: usuarioError } = await supabase
    .from('usuarios')
    .select('id, tenant_id, rol')
    .eq('auth_user_id', user.id)
    .eq('is_deleted', false)
    .single()

  if (usuarioError || !usuario) return { error: 'Usuario no encontrado' }
  if (usuario.rol !== 'admin') return { error: 'Solo el administrador del negocio puede editar la configuración' }

  const tenantId = usuario.tenant_id
  if (!tenantId) return { error: 'Usuario sin negocio asignado' }

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (data.nombre !== undefined) {
    if (!data.nombre.trim()) return { error: 'El nombre del negocio es requerido' }
    updatePayload.nombre = data.nombre.trim()
  }
  if (data.logo_url !== undefined) updatePayload.logo_url = data.logo_url.trim() || null
  if (data.direccion !== undefined) updatePayload.direccion = data.direccion.trim() || null
  if (data.telefono !== undefined) updatePayload.telefono = data.telefono.trim() || null
  if (data.email !== undefined) updatePayload.email = data.email.trim() || null
  if (data.ruc !== undefined) updatePayload.ruc = data.ruc.trim() || null
  if (data.razon_social !== undefined) updatePayload.razon_social = data.razon_social.trim() || null
  if (data.actividad_economica !== undefined) updatePayload.actividad_economica = data.actividad_economica.trim() || null
  if (data.saludo_final !== undefined) {
    const { data: tenantCurrent, error: tenantError } = await supabase
      .from('tenants')
      .select('config_impresion')
      .eq('id', tenantId)
      .eq('is_deleted', false)
      .single()

    if (tenantError || !tenantCurrent) return { error: 'No se pudo cargar configuración de impresión' }

    const currentConfig =
      tenantCurrent.config_impresion && typeof tenantCurrent.config_impresion === 'object'
        ? (tenantCurrent.config_impresion as Record<string, unknown>)
        : {}

    updatePayload.config_impresion = {
      ...currentConfig,
      pie_ticket: data.saludo_final.trim() || '¡Gracias por tu compra!',
    }
  }

  const { error } = await supabase
    .from('tenants')
    .update(updatePayload)
    .eq('id', tenantId)
    .eq('is_deleted', false)

  if (error) return { error: 'Error al guardar. Intentalo nuevamente.' }
  return { error: null }
}

/** Nombre del bucket de Supabase Storage para logos/fotos del local */
const LOGOS_BUCKET = 'logos'

/** Tipos MIME permitidos para la foto del local */
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/**
 * Sube la foto del local a Supabase Storage y devuelve la URL pública.
 * Solo admin del tenant. El archivo se guarda en logos/{tenant_id}/logo (se sobrescribe).
 */
export async function uploadLogoMyTenant(formData: FormData): Promise<{ error: string | null; url: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No hay sesión activa', url: null }

  const { data: usuario, error: usuarioError } = await supabase
    .from('usuarios')
    .select('id, tenant_id, rol')
    .eq('auth_user_id', user.id)
    .eq('is_deleted', false)
    .single()

  if (usuarioError || !usuario) return { error: 'Usuario no encontrado', url: null }
  if (usuario.rol !== 'admin') return { error: 'Solo el administrador del negocio puede subir la foto', url: null }

  const tenantId = usuario.tenant_id
  if (!tenantId) return { error: 'Usuario sin negocio asignado', url: null }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) return { error: 'Seleccioná una imagen', url: null }
  if (file.size === 0) return { error: 'El archivo está vacío', url: null }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type))
    return { error: 'Formato no permitido. Usá JPG, PNG, WebP o GIF.', url: null }
  if (file.size > 5 * 1024 * 1024) return { error: 'La imagen no puede superar 5 MB', url: null }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg'
  const path = `${tenantId}/logo.${safeExt}`

  // Usar admin client para la subida: evita RLS del bucket (la identidad ya se validó arriba).
  const adminClient = createAdminClient()
  const { error: uploadError } = await adminClient.storage
    .from(LOGOS_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) {
    if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
      return { error: 'El almacenamiento de imágenes no está configurado. Contactá al soporte.', url: null }
    }
    if (uploadError.message?.toLowerCase().includes('row-level security') || uploadError.message?.toLowerCase().includes('policy')) {
      return { error: 'No hay permiso para subir imágenes. Revisá las políticas del bucket "logos" en Supabase.', url: null }
    }
    return { error: uploadError.message || 'Error al subir la imagen', url: null }
  }

  const { data: urlData } = adminClient.storage.from(LOGOS_BUCKET).getPublicUrl(path)
  return { error: null, url: urlData.publicUrl }
}

export interface UsuarioDelTenant {
  id: string
  nombre: string
  email: string
  rol: string
  activo: boolean
}

/**
 * Lista todos los usuarios del tenant del usuario en sesión.
 * Cualquier usuario autenticado del tenant puede ver la lista (para mostrar en el header).
 */
export async function listUsuariosMyTenant(): Promise<{ error: string | null; usuarios: UsuarioDelTenant[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No hay sesión activa', usuarios: [] }

  const { data: usuario, error: usuarioError } = await supabase
    .from('usuarios')
    .select('id, tenant_id, rol')
    .eq('auth_user_id', user.id)
    .eq('is_deleted', false)
    .single()

  if (usuarioError || !usuario) return { error: 'Usuario no encontrado', usuarios: [] }
  const tenantId = usuario.tenant_id
  if (!tenantId) return { error: 'Usuario sin negocio asignado', usuarios: [] }

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, email, rol, activo')
    .eq('tenant_id', tenantId)
    .eq('is_deleted', false)
    .order('rol', { ascending: true })
    .order('nombre', { ascending: true })

  if (error) return { error: 'Error al cargar usuarios', usuarios: [] }
  return { error: null, usuarios: (data ?? []) as UsuarioDelTenant[] }
}

/**
 * Activa o desactiva el módulo de gestión de mesas para el tenant del admin en sesión.
 * Solo administradores pueden cambiar esta configuración.
 */
export async function toggleGestionMesas(enabled: boolean): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No hay sesión activa' }

  const { data: usuario, error: usuarioError } = await supabase
    .from('usuarios')
    .select('id, tenant_id, rol')
    .eq('auth_user_id', user.id)
    .eq('is_deleted', false)
    .single()

  if (usuarioError || !usuario) return { error: 'Usuario no encontrado' }
  if (usuario.rol !== 'admin') return { error: 'Solo el administrador puede cambiar esta configuración' }

  const tenantId = usuario.tenant_id
  if (!tenantId) return { error: 'Usuario sin negocio asignado' }

  const { error } = await supabase
    .from('tenants')
    .update({ gestion_mesas: enabled, updated_at: new Date().toISOString() })
    .eq('id', tenantId)
    .eq('is_deleted', false)

  if (error) return { error: 'Error al guardar. Intentalo nuevamente.' }
  return { error: null }
}

/**
 * Activa o desactiva el módulo de delivery para el tenant del admin en sesión.
 * Solo administradores pueden cambiar esta configuración.
 */
export async function toggleDelivery(enabled: boolean): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No hay sesión activa' }

  const { data: usuario, error: usuarioError } = await supabase
    .from('usuarios')
    .select('id, tenant_id, rol')
    .eq('auth_user_id', user.id)
    .eq('is_deleted', false)
    .single()

  if (usuarioError || !usuario) return { error: 'Usuario no encontrado' }
  if (usuario.rol !== 'admin') return { error: 'Solo el administrador puede cambiar esta configuración' }

  const tenantId = usuario.tenant_id
  if (!tenantId) return { error: 'Usuario sin negocio asignado' }

  const { error } = await supabase
    .from('tenants')
    .update({ has_delivery: enabled, updated_at: new Date().toISOString() })
    .eq('id', tenantId)
    .eq('is_deleted', false)

  if (error) return { error: 'Error al guardar. Intentalo nuevamente.' }
  return { error: null }
}

/**
 * Permite al admin del tenant actualizar el nombre de un usuario del mismo tenant.
 */
export async function updateNombreUsuarioMyTenant(usuarioId: string, nombre: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No hay sesión activa' }

  const { data: currentUser, error: currentError } = await supabase
    .from('usuarios')
    .select('id, tenant_id, rol')
    .eq('auth_user_id', user.id)
    .eq('is_deleted', false)
    .single()

  if (currentError || !currentUser) return { error: 'Usuario no encontrado' }
  if (currentUser.rol !== 'admin') return { error: 'Solo el administrador puede editar nombres' }

  const tenantId = currentUser.tenant_id
  if (!tenantId) return { error: 'Usuario sin negocio asignado' }

  const nombreTrim = nombre.trim()
  if (!nombreTrim) return { error: 'El nombre no puede estar vacío' }

  const { error } = await supabase
    .from('usuarios')
    .update({ nombre: nombreTrim, updated_at: new Date().toISOString() })
    .eq('id', usuarioId)
    .eq('tenant_id', tenantId)
    .eq('is_deleted', false)

  if (error) return { error: 'Error al guardar el nombre' }
  return { error: null }
}
