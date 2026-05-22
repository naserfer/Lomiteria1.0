'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canPurgeTenant } from '@/lib/owner/tenantDeletionGuard'

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface CreateTenantData {
  nombreNegocio: string
  ruc?: string
  razon_social?: string
  actividad_economica?: string
  email?: string
  telefono?: string
  direccion?: string
  logo_url?: string
}

export interface UpdateTenantData {
  nombre?: string
  ruc?: string
  razon_social?: string
  actividad_economica?: string
  email?: string
  telefono?: string
  direccion?: string
  logo_url?: string
}

export interface CreateTenantUserData {
  tenantId: string
  nombreAdmin: string
  emailAdmin: string
  passwordAdmin: string
}

export interface CreateCajeroData {
  nombre: string
  email: string
  password: string
}

export type TenantUserRole = 'admin' | 'cajero'

// ─── Helpers internos ───────────────────────────────────────────────────────

function generarSlug(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

async function resolverSlugUnico(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slugBase: string
): Promise<string> {
  const { data: existente } = await supabase
    .from('tenants')
    .select('slug')
    .eq('slug', slugBase)
    .maybeSingle()

  if (!existente) return slugBase

  const { data: similares } = await supabase
    .from('tenants')
    .select('slug')
    .like('slug', `${slugBase}%`)

  const numeros = (similares ?? [])
    .map((r) => {
      const match = r.slug.match(new RegExp(`^${slugBase}-(\\d+)$`))
      return match ? parseInt(match[1], 10) : 0
    })
    .filter((n) => n > 0)

  const siguiente = numeros.length > 0 ? Math.max(...numeros) + 1 : 2
  return `${slugBase}-${siguiente}`
}

interface CreateDefaultPrinterConfigResult {
  error: string | null
  warning: string | null
}

async function createDefaultPrinterConfig(tenantId: string, slug: string): Promise<CreateDefaultPrinterConfigResult> {
  const adminClient = createAdminClient()

  const payload = {
    lomiteria_id: tenantId,
    printer_id: `${slug}-printer-1`,
    agent_ip: 'localhost',
    agent_port: 3001,
    tipo_impresora: 'usb' as const,
    nombre_impresora: 'Impresora Térmica Cocina',
    ubicacion: 'Cocina',
    activo: true,
  }

  const insertResult = await adminClient.from('printer_config').insert(payload)
  if (!insertResult.error) {
    return { error: null, warning: null }
  }

  console.error('[createTenant] insert printer_config failed', {
    tenantId,
    slug,
    code: insertResult.error.code,
    message: insertResult.error.message,
    details: insertResult.error.details,
    hint: insertResult.error.hint,
  })

  const upsertResult = await adminClient
    .from('printer_config')
    .upsert(payload, { onConflict: 'lomiteria_id' })

  if (!upsertResult.error) {
    return {
      error: null,
      warning: 'La configuración de impresora tuvo un fallo inicial, pero se recuperó automáticamente.',
    }
  }

  console.error('[createTenant] upsert printer_config failed', {
    tenantId,
    slug,
    code: upsertResult.error.code,
    message: upsertResult.error.message,
    details: upsertResult.error.details,
    hint: upsertResult.error.hint,
  })

  return {
    error: upsertResult.error.message,
    warning:
      'La lomitería se creó, pero no se pudo guardar su configuración de impresora. Configúrala manualmente en el panel de impresoras.',
  }
}

/**
 * Verifica que el usuario que llama la acción sea un owner.
 */
async function assertOwner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' as const, supabase: null }

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('auth_user_id', user.id)
    .eq('is_deleted', false)
    .single()

  if (usuario?.rol !== 'owner') return { error: 'Sin permisos' as const, supabase: null }
  return { error: null, supabase }
}

/**
 * Verifica que el usuario sea owner (cualquier tenant) o admin del tenant indicado.
 * Usado para gestión de productos: owner y admin del tenant pueden crear/listar.
 */
async function assertOwnerOrAdminForTenant(tenantId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' as const }

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('rol, tenant_id')
    .eq('auth_user_id', user.id)
    .eq('is_deleted', false)
    .single()

  if (!usuario) return { error: 'No autenticado' as const }
  if (usuario.rol === 'owner') return { error: null }
  if (usuario.rol === 'admin' && usuario.tenant_id === tenantId) return { error: null }
  return { error: 'Sin permisos' as const }
}

// ─── Actions ────────────────────────────────────────────────────────────────

/**
 * Lista todos los tenants activos con el conteo de sus usuarios.
 */
export async function listTenants() {
  const { error: authError, supabase } = await assertOwner()
  if (authError || !supabase) return { error: authError, tenants: [] }

  const { data: tenants, error } = await supabase
    .from('tenants')
    .select(`
      id, nombre, slug, ruc, email, telefono, direccion, logo_url, activo, created_at,
      usuarios(count)
    `)
    .eq('is_deleted', false)
    .neq('slug', 'ardentium')
    .neq('id', '00000000-0000-0000-0000-000000000001')
    .order('created_at', { ascending: false })

  if (error) return { error: 'Error al cargar lomiterías', tenants: [] }
  return { error: null, tenants: tenants ?? [] }
}

/**
 * Crea un nuevo tenant (lomitería) con su contador de pedidos.
 */
export async function createTenant(data: CreateTenantData) {
  const { error: authError, supabase } = await assertOwner()
  if (authError || !supabase) return { error: authError }

  if (!data.nombreNegocio.trim()) return { error: 'El nombre del negocio es requerido' }

  const slugBase = generarSlug(data.nombreNegocio)
  if (!slugBase) return { error: 'El nombre del negocio no generó un slug válido' }

  const slug = await resolverSlugUnico(supabase, slugBase)

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      nombre: data.nombreNegocio.trim(),
      slug,
      ruc: data.ruc?.trim() || null,
      razon_social: data.razon_social?.trim() || null,
      actividad_economica: data.actividad_economica?.trim() || null,
      email: data.email?.trim() || null,
      telefono: data.telefono?.trim() || null,
      direccion: data.direccion?.trim() || null,
      logo_url: data.logo_url?.trim() || null,
      activo: true,
      is_deleted: false,
    })
    .select('id, nombre, slug')
    .single()

  if (tenantError || !tenant) {
    return { error: 'Error al crear la lomitería. Intentalo nuevamente.' }
  }

  // Inicializar contador de pedidos
  await supabase
    .from('tenant_pedido_counters')
    .insert({ tenant_id: tenant.id, ultimo_numero: 0, ciclo_actual: 1 })

  const printerConfigResult = await createDefaultPrinterConfig(tenant.id, slug)
  if (printerConfigResult.error) {
    console.error('[createTenant] printer_config no persistido tras reintento', {
      tenantId: tenant.id,
      slug,
      error: printerConfigResult.error,
    })
  }

  return { error: null, tenant, printerConfigWarning: printerConfigResult.warning }
}

/**
 * Crea el usuario administrador de un tenant.
 * Usa la Admin API (service role) para crear el auth user sin requerir signup.
 */
export async function createTenantUser(data: CreateTenantUserData) {
  const { error: authError, supabase } = await assertOwner()
  if (authError || !supabase) return { error: authError }

  if (!data.nombreAdmin.trim()) return { error: 'El nombre del administrador es requerido' }
  if (!data.emailAdmin.trim()) return { error: 'El email es requerido' }
  if (!data.passwordAdmin || data.passwordAdmin.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres' }
  }

  // Verificar que el tenant existe
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('id', data.tenantId)
    .eq('is_deleted', false)
    .single()

  if (!tenant) return { error: 'La lomitería indicada no existe' }

  // Crear auth user con Admin API (no requiere que el usuario haga signup)
  const adminClient = createAdminClient()
  const { data: authUser, error: authUserError } = await adminClient.auth.admin.createUser({
    email: data.emailAdmin.trim(),
    password: data.passwordAdmin,
    email_confirm: true, // confirmar email automáticamente para que pueda loguear ya
    user_metadata: { full_name: data.nombreAdmin.trim() },
  })

  if (authUserError || !authUser.user) {
    if (authUserError?.message.includes('already registered')) {
      return { error: 'Ya existe un usuario con ese correo electrónico.' }
    }
    return { error: authUserError?.message ?? 'Error al crear el usuario.' }
  }

  // Crear registro en tabla usuarios
  const { error: usuarioError } = await supabase.from('usuarios').insert({
    auth_user_id: authUser.user.id,
    tenant_id: data.tenantId,
    email: data.emailAdmin.trim(),
    nombre: data.nombreAdmin.trim(),
    rol: 'admin',
    activo: true,
    is_deleted: false,
  })

  if (usuarioError) {
    // Rollback: eliminar el auth user creado
    await adminClient.auth.admin.deleteUser(authUser.user.id)
    return { error: 'Error al guardar el perfil del usuario. Intentalo nuevamente.' }
  }

  return { error: null, email: data.emailAdmin.trim() }
}

/**
 * Activa o desactiva una lomitería (soft toggle).
 */
export async function toggleTenantStatus(tenantId: string, activo: boolean) {
  const { error: authError, supabase } = await assertOwner()
  if (authError || !supabase) return { error: authError }

  const { error } = await supabase
    .from('tenants')
    .update({ activo })
    .eq('id', tenantId)
    .neq('slug', 'sistema')

  if (error) return { error: 'Error al actualizar el estado.' }
  return { error: null }
}

/**
 * Obtiene los datos completos de un tenant para visualización/edición.
 */
export async function getTenantDetail(tenantId: string) {
  const { error: authError, supabase } = await assertOwner()
  if (authError || !supabase) return { error: authError, tenant: null }

  const { data, error } = await supabase
    .from('tenants')
    .select('id, nombre, slug, ruc, razon_social, actividad_economica, email, telefono, direccion, logo_url, activo, created_at')
    .eq('id', tenantId)
    .eq('is_deleted', false)
    .single()

  if (error || !data) return { error: 'Lomitería no encontrada', tenant: null }
  return { error: null, tenant: data }
}

/**
 * Actualiza los datos de un tenant (nombre, contacto, logo).
 */
export async function updateTenant(tenantId: string, data: UpdateTenantData) {
  const { error: authError, supabase } = await assertOwner()
  if (authError || !supabase) return { error: authError }

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (data.nombre !== undefined) {
    if (!data.nombre.trim()) return { error: 'El nombre del negocio es requerido' }
    updatePayload.nombre = data.nombre.trim()
  }
  if (data.ruc !== undefined) updatePayload.ruc = data.ruc.trim() || null
  if (data.razon_social !== undefined) updatePayload.razon_social = data.razon_social.trim() || null
  if (data.actividad_economica !== undefined) updatePayload.actividad_economica = data.actividad_economica.trim() || null
  if (data.email !== undefined) updatePayload.email = data.email.trim() || null
  if (data.telefono !== undefined) updatePayload.telefono = data.telefono.trim() || null
  if (data.direccion !== undefined) updatePayload.direccion = data.direccion.trim() || null
  if (data.logo_url !== undefined) updatePayload.logo_url = data.logo_url.trim() || null

  const { error } = await supabase
    .from('tenants')
    .update(updatePayload)
    .eq('id', tenantId)
    .eq('is_deleted', false)
    .neq('slug', 'sistema')

  if (error) return { error: 'Error al actualizar la lomitería. Intentalo nuevamente.' }
  return { error: null }
}

// ─── Gestión de productos (owner cross-tenant) ───────────────────────────────

export interface CreateProductoOwnerData {
  nombre: string
  descripcion?: string
  precio: number
  categoria_id?: string
  disponible: boolean
  imagen_url?: string
  /** Puntos bonus adicionales por unidad vendida (0 = solo fórmula automática) */
  puntos_extra?: number
  tipo: 'con_receta' | 'combo' | 'sin_receta'
  receta?: Array<{
    ingrediente_id: string
    cantidad: number
    unidad: string
    obligatorio: boolean
  }>
  combo_items?: Array<{
    producto_id: string
    cantidad: number
  }>
  inventario_id?: string  // ingrediente_id para sin_receta
}

export type RecetaLineaProductoOwner = {
  ingrediente_id: string
  cantidad: number
  unidad: string
  obligatorio: boolean
}

export type RecetaLineaProductoOwnerConNombre = RecetaLineaProductoOwner & {
  nombre: string
}

/**
 * Obtiene la receta de un producto con receta (owner/admin del tenant).
 */
export async function getRecetaProductoOwner(tenantId: string, productoId: string) {
  const { error: authError } = await assertOwnerOrAdminForTenant(tenantId)
  if (authError) return { error: authError, lineas: [] as RecetaLineaProductoOwnerConNombre[] }

  const adminClient = createAdminClient()
  const { data: producto, error: prodError } = await adminClient
    .from('productos')
    .select('id, tiene_receta')
    .eq('id', productoId)
    .eq('tenant_id', tenantId)
    .neq('is_deleted', true)
    .maybeSingle()

  if (prodError || !producto) {
    return { error: 'Producto no encontrado', lineas: [] as RecetaLineaProductoOwnerConNombre[] }
  }
  if (!producto.tiene_receta) {
    return { error: 'Este producto no tiene receta', lineas: [] as RecetaLineaProductoOwnerConNombre[] }
  }

  const { data: rows, error: recError } = await adminClient
    .from('recetas_producto')
    .select(
      `
      ingrediente_id,
      cantidad,
      unidad,
      obligatorio,
      ingrediente:ingrediente_id ( nombre, unidad )
    `
    )
    .eq('tenant_id', tenantId)
    .eq('producto_id', productoId)
    .order('ingrediente_id')

  if (recError) {
    console.error('[getRecetaProductoOwner]', recError)
    return { error: 'Error al cargar la receta', lineas: [] as RecetaLineaProductoOwnerConNombre[] }
  }

  type IngRow = { nombre?: string; unidad?: string } | null
  const lineas: RecetaLineaProductoOwnerConNombre[] = (rows ?? []).map((row: Record<string, unknown>) => {
    const ing = row.ingrediente as IngRow
    const nombre = ing?.nombre ?? 'Ingrediente'
    const unidadRow = (row.unidad as string | null) ?? ing?.unidad ?? 'unidad'
    return {
      ingrediente_id: row.ingrediente_id as string,
      cantidad: Number(row.cantidad),
      unidad: unidadRow,
      obligatorio: Boolean(row.obligatorio ?? true),
      nombre,
    }
  })

  return { error: null, lineas }
}

/**
 * Obtiene los datos básicos de un tenant (para mostrar en el header de la página de productos).
 */
export async function getTenantForOwner(tenantId: string) {
  const { error: authError, supabase } = await assertOwner()
  if (authError || !supabase) return { error: authError, tenant: null }

  const { data, error } = await supabase
    .from('tenants')
    .select('id, nombre, slug, logo_url')
    .eq('id', tenantId)
    .eq('is_deleted', false)
    .single()

  if (error || !data) return { error: 'Lomitería no encontrada', tenant: null }
  return { error: null, tenant: data }
}

/**
 * Lista los productos de un tenant específico (sin filtrar por disponible para la vista owner).
 */
export async function listProductosOwner(tenantId: string) {
  const { error: authError } = await assertOwnerOrAdminForTenant(tenantId)
  if (authError) return { error: authError, productos: [] }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('productos')
    .select('id, nombre, descripcion, precio, disponible, tiene_receta, imagen_url, categoria_id, puntos_extra')
    .eq('tenant_id', tenantId)
    .neq('is_deleted', true)       // cubre is_deleted = false Y is_deleted = null
    .order('nombre', { ascending: true })

  if (error) {
    console.error('[listProductosOwner] Error al consultar productos:', error)
    return { error: `Error al cargar productos: ${error.message}`, productos: [] }
  }

  console.log(`[listProductosOwner] tenant=${tenantId} → ${data?.length ?? 0} productos`)
  return { error: null, productos: data ?? [] }
}

/**
 * Lista las categorías activas de un tenant específico.
 */
export async function listCategoriasOwner(tenantId: string) {
  const { error: authError } = await assertOwnerOrAdminForTenant(tenantId)
  if (authError) return { error: authError, categorias: [] }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('categorias')
    .select('id, nombre')
    .eq('tenant_id', tenantId)
    .eq('activa', true)
    .order('orden', { ascending: true })

  if (error) return { error: 'Error al cargar categorías', categorias: [] }
  return { error: null, categorias: data ?? [] }
}

/**
 * Lista los ingredientes activos de un tenant específico.
 */
export async function listIngredientesOwner(tenantId: string) {
  const { error: authError } = await assertOwnerOrAdminForTenant(tenantId)
  if (authError) return { error: authError, ingredientes: [] }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('ingredientes')
    .select('id, nombre, unidad')
    .eq('tenant_id', tenantId)
    .eq('activo', true)
    .order('nombre', { ascending: true })

  if (error) return { error: 'Error al cargar ingredientes', ingredientes: [] }
  return { error: null, ingredientes: data ?? [] }
}

/**
 * Lista items de inventario sin producto vinculado (disponibles para crear producto sin receta).
 */
export async function listInventarioSinProducto(tenantId: string) {
  const { error: authError } = await assertOwner()
  if (authError) return { error: authError, items: [] }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('inventario')
    .select('id, nombre, stock_actual, stock_minimo, unidad, tipo_inventario')
    .eq('tenant_id', tenantId)
    .is('producto_id', null)
    .order('nombre', { ascending: true })

  if (error) return { error: 'Error al cargar items de inventario', items: [] }
  return { error: null, items: data ?? [] }
}

/**
 * Crea un producto (con receta o combo) para un tenant, ejecutado desde el rol owner.
 * Usa el admin client para bypass de RLS cross-tenant.
 */
export async function createProductoOwner(tenantId: string, data: CreateProductoOwnerData) {
  const { error: authError } = await assertOwnerOrAdminForTenant(tenantId)
  if (authError) return { error: authError, producto: null }

  if (!data.nombre.trim()) return { error: 'El nombre del producto es requerido', producto: null }
  if (!data.precio || data.precio <= 0) return { error: 'El precio debe ser mayor a cero', producto: null }
  if (!data.categoria_id) return { error: 'Debes seleccionar una categoría', producto: null }
  if (data.tipo === 'con_receta' && (!data.receta || data.receta.length === 0)) {
    return { error: 'Debes agregar al menos un ingrediente a la receta', producto: null }
  }
  if (data.tipo === 'combo' && (!data.combo_items || data.combo_items.length === 0)) {
    return { error: 'Debes agregar al menos un producto al combo', producto: null }
  }
  if (data.tipo === 'sin_receta' && !data.inventario_id) {
    return { error: 'Debes seleccionar una materia prima', producto: null }
  }

  const adminClient = createAdminClient()

  // 1. Crear el producto
  const { data: producto, error: productoError } = await adminClient
    .from('productos')
    .insert({
      tenant_id: tenantId,
      nombre: data.nombre.trim(),
      descripcion: data.descripcion?.trim() || null,
      precio: data.precio,
      categoria_id: data.categoria_id || null,
      disponible: data.disponible,
      imagen_url: data.imagen_url?.trim() || null,
      tiene_receta: data.tipo === 'con_receta',
      puntos_extra: data.puntos_extra ?? 0,
      is_deleted: false,
    })
    .select('id, nombre')
    .single()

  if (productoError || !producto) {
    return { error: 'Error al crear el producto. Inténtalo de nuevo.', producto: null }
  }

  // 2. Insertar ítems de receta
  if (data.tipo === 'con_receta' && data.receta && data.receta.length > 0) {
    const recetaItems = data.receta.map((item) => ({
      tenant_id: tenantId,
      producto_id: producto.id,
      ingrediente_id: item.ingrediente_id,
      cantidad: item.cantidad,
      unidad: item.unidad,
      obligatorio: item.obligatorio,
    }))

    const { error: recetaError } = await adminClient
      .from('recetas_producto')
      .insert(recetaItems)

    if (recetaError) {
      await adminClient.from('productos').delete().eq('id', producto.id)
      return { error: 'Error al guardar la receta del producto', producto: null }
    }
  }

  // 3. Insertar ítems de combo
  if (data.tipo === 'combo' && data.combo_items && data.combo_items.length > 0) {
    const comboInserts = data.combo_items.map((item) => ({
      tenant_id: tenantId,
      combo_id: producto.id,
      producto_id: item.producto_id,
      cantidad: item.cantidad,
    }))

    const { error: comboError } = await adminClient
      .from('combo_items')
      .insert(comboInserts)

    if (comboError) {
      await adminClient.from('productos').delete().eq('id', producto.id)
      return { error: 'Error al guardar los ítems del combo', producto: null }
    }
  }

  // 4. Crear inventario para productos sin receta (vinculado a un ingrediente)
  if (data.tipo === 'sin_receta' && data.inventario_id) {
    // data.inventario_id contiene el ingrediente_id seleccionado
    const ingredienteId = data.inventario_id

    // Obtener datos del ingrediente para copiar stock info
    const { data: ingrediente, error: ingError } = await adminClient
      .from('ingredientes')
      .select('stock_actual, stock_minimo, unidad, controlar_stock, nombre')
      .eq('id', ingredienteId)
      .eq('tenant_id', tenantId)
      .single()

    if (ingError || !ingrediente) {
      await adminClient.from('productos').delete().eq('id', producto.id)
      return { error: 'Error al obtener datos de la materia prima', producto: null }
    }

    // Crear fila de inventario vinculada al producto
    const { error: invError } = await adminClient
      .from('inventario')
      .insert({
        tenant_id: tenantId,
        producto_id: producto.id,
        stock_actual: ingrediente.stock_actual ?? 0,
        stock_minimo: ingrediente.stock_minimo ?? 0,
        unidad: ingrediente.unidad ?? 'unidad',
        controlar_stock: ingrediente.controlar_stock ?? true,
      })

    if (invError) {
      console.error('Error al insertar inventario:', invError)
      await adminClient.from('productos').delete().eq('id', producto.id)
      return { error: `Error al crear el inventario: ${invError.message}`, producto: null }
    }
  }

  return { error: null, producto }
}

/**
 * Elimina (soft delete) un producto de un tenant, ejecutado desde el rol owner.
 */
export async function deleteProductoOwner(productoId: string, tenantId: string) {
  const { error: authError } = await assertOwnerOrAdminForTenant(tenantId)
  if (authError) return { error: authError }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('productos')
    .update({ is_deleted: true })
    .eq('id', productoId)
    .eq('tenant_id', tenantId)

  if (error) return { error: 'Error al eliminar el producto. Inténtalo de nuevo.' }

  // Desvincular inventario si el producto tenía un item de inventario asociado
  await adminClient
    .from('inventario')
    .update({ producto_id: null })
    .eq('producto_id', productoId)
    .eq('tenant_id', tenantId)

  return { error: null }
}

/**
 * Actualiza los campos básicos de un producto (nombre, descripcion, precio, disponible, imagen_url, categoria_id).
 * Si `receta` está definido, reemplaza por completo las filas en `recetas_producto` (solo si el producto tiene `tiene_receta`).
 */
export async function updateProductoOwner(
  productoId: string,
  tenantId: string,
  data: {
    nombre: string
    descripcion?: string | null
    precio: number
    disponible: boolean
    imagen_url?: string | null
    categoria_id?: string | null
    puntos_extra?: number | null
    /** Si se envía, debe ser el snapshot completo de la receta (productos con receta). */
    receta?: RecetaLineaProductoOwner[]
  }
) {
  const { error: authError } = await assertOwnerOrAdminForTenant(tenantId)
  if (authError) return { error: authError }

  if (!data.nombre.trim()) return { error: 'El nombre del producto es obligatorio' }
  if (!Number.isFinite(data.precio) || data.precio < 0) return { error: 'El precio no es válido' }

  const adminClient = createAdminClient()

  const { data: producto, error: prodFetchError } = await adminClient
    .from('productos')
    .select('id, tiene_receta')
    .eq('id', productoId)
    .eq('tenant_id', tenantId)
    .neq('is_deleted', true)
    .maybeSingle()

  if (prodFetchError || !producto) {
    return { error: 'Producto no encontrado' }
  }

  if (data.receta !== undefined) {
    if (!producto.tiene_receta) {
      return { error: 'Este producto no tiene receta; no se puede editar la receta aquí' }
    }
    if (!data.receta.length) {
      return { error: 'Debes agregar al menos un ingrediente a la receta' }
    }
    const ids = data.receta.map((r) => r.ingrediente_id)
    if (new Set(ids).size !== ids.length) {
      return { error: 'No podés repetir el mismo ingrediente en la receta' }
    }
    for (const line of data.receta) {
      if (!line.ingrediente_id?.trim()) return { error: 'Ingrediente inválido en la receta' }
      if (!Number.isFinite(line.cantidad) || line.cantidad <= 0) {
        return { error: 'Cada ingrediente debe tener una cantidad mayor a cero' }
      }
      if (!line.unidad?.trim()) return { error: 'Cada línea de receta debe tener unidad' }
    }

    const { data: ingRows, error: ingErr } = await adminClient
      .from('ingredientes')
      .select('id')
      .eq('tenant_id', tenantId)
      .in('id', ids)

    if (ingErr || !ingRows || ingRows.length !== ids.length) {
      return { error: 'Uno o más ingredientes no son válidos para este negocio' }
    }
  }

  const { data: backupRows, error: backupErr } =
    data.receta !== undefined
      ? await adminClient
          .from('recetas_producto')
          .select('ingrediente_id, cantidad, unidad, obligatorio')
          .eq('tenant_id', tenantId)
          .eq('producto_id', productoId)
      : { data: null as null, error: null }

  if (backupErr) {
    console.error('[updateProductoOwner] backup receta', backupErr)
    return { error: 'Error al preparar la actualización de la receta' }
  }

  const { error: updateError } = await adminClient
    .from('productos')
    .update({
      nombre: data.nombre.trim(),
      descripcion: data.descripcion?.trim() || null,
      precio: data.precio,
      disponible: data.disponible,
      imagen_url: data.imagen_url?.trim() || null,
      categoria_id: data.categoria_id || null,
      puntos_extra: data.puntos_extra ?? 0,
    })
    .eq('id', productoId)
    .eq('tenant_id', tenantId)

  if (updateError) return { error: 'Error al actualizar el producto. Inténtalo de nuevo.' }

  if (data.receta !== undefined && producto.tiene_receta) {
    const { error: delError } = await adminClient
      .from('recetas_producto')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('producto_id', productoId)

    if (delError) {
      console.error('[updateProductoOwner] delete receta', delError)
      return { error: 'Error al actualizar la receta del producto' }
    }

    const recetaItems = data.receta.map((item) => ({
      tenant_id: tenantId,
      producto_id: productoId,
      ingrediente_id: item.ingrediente_id,
      cantidad: item.cantidad,
      unidad: item.unidad.trim(),
      obligatorio: item.obligatorio,
    }))

    const { error: insError } = await adminClient.from('recetas_producto').insert(recetaItems)

    if (insError) {
      console.error('[updateProductoOwner] insert receta', insError)
      if (backupRows?.length) {
        const restore = backupRows.map((row) => ({
          tenant_id: tenantId,
          producto_id: productoId,
          ingrediente_id: row.ingrediente_id,
          cantidad: row.cantidad,
          unidad: row.unidad ?? 'unidad',
          obligatorio: row.obligatorio ?? true,
        }))
        const { error: restoreErr } = await adminClient.from('recetas_producto').insert(restore)
        if (restoreErr) {
          console.error('[updateProductoOwner] restore receta CRÍTICO', restoreErr)
        }
      }
      return { error: 'Error al guardar la receta del producto. Los datos del producto sí se actualizaron.' }
    }
  }

  return { error: null }
}

// ─── Gestión de usuarios por tenant (owner cross-tenant) ─────────────────────

const VALID_TENANT_ROLES: TenantUserRole[] = ['admin', 'cajero']
const ROLE_LABELS: Record<TenantUserRole, string> = { admin: 'administrador', cajero: 'cajero' }

/**
 * Lista los usuarios de un tenant filtrados por rol.
 */
export async function listUsuariosTenantOwner(tenantId: string, rol: TenantUserRole) {
  const { error: authError, supabase } = await assertOwner()
  if (authError || !supabase) return { error: authError, usuarios: [] }
  if (!VALID_TENANT_ROLES.includes(rol)) return { error: 'Rol inválido', usuarios: [] }

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, auth_user_id, nombre, email, activo, created_at')
    .eq('tenant_id', tenantId)
    .eq('rol', rol)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[listUsuariosTenantOwner] Error:', error)
    return { error: `Error al cargar ${ROLE_LABELS[rol]}s`, usuarios: [] }
  }

  return { error: null, usuarios: data ?? [] }
}

/**
 * Crea un usuario (admin o cajero) para un tenant.
 * Usa la Admin API (service role) para crear el auth user + registro en usuarios.
 */
export async function createUsuarioTenantOwner(tenantId: string, rol: TenantUserRole, data: CreateCajeroData) {
  const { error: authError, supabase } = await assertOwner()
  if (authError || !supabase) return { error: authError }
  if (!VALID_TENANT_ROLES.includes(rol)) return { error: 'Rol inválido' }

  const label = ROLE_LABELS[rol]

  if (!data.nombre.trim()) return { error: `El nombre del ${label} es requerido` }
  if (!data.email.trim()) return { error: 'El email es requerido' }
  if (!data.password || data.password.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres' }
  }

  // Verificar que el tenant existe
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('id', tenantId)
    .eq('is_deleted', false)
    .single()

  if (!tenant) return { error: 'La lomitería indicada no existe' }

  // Crear auth user con Admin API
  const adminClient = createAdminClient()
  const { data: authUser, error: authUserError } = await adminClient.auth.admin.createUser({
    email: data.email.trim(),
    password: data.password,
    email_confirm: true,
    user_metadata: { full_name: data.nombre.trim() },
  })

  if (authUserError || !authUser.user) {
    if (authUserError?.message.includes('already registered')) {
      return { error: 'Ya existe un usuario con ese correo electrónico.' }
    }
    return { error: authUserError?.message ?? 'Error al crear el usuario.' }
  }

  // Crear registro en tabla usuarios
  const { error: usuarioError } = await supabase.from('usuarios').insert({
    auth_user_id: authUser.user.id,
    tenant_id: tenantId,
    email: data.email.trim(),
    nombre: data.nombre.trim(),
    rol,
    activo: true,
    is_deleted: false,
  })

  if (usuarioError) {
    // Rollback: eliminar el auth user creado
    await adminClient.auth.admin.deleteUser(authUser.user.id)
    return { error: `Error al guardar el perfil del ${label}. Intentalo nuevamente.` }
  }

  return { error: null, email: data.email.trim() }
}

/**
 * Elimina un usuario de un tenant (soft delete en usuarios + elimina auth user).
 */
export async function deleteUsuarioTenantOwner(usuarioId: string, tenantId: string) {
  const { error: authError, supabase } = await assertOwner()
  if (authError || !supabase) return { error: authError }

  // Obtener el auth_user_id antes de marcar como eliminado
  const { data: usuario, error: fetchError } = await supabase
    .from('usuarios')
    .select('auth_user_id, rol')
    .eq('id', usuarioId)
    .eq('tenant_id', tenantId)
    .eq('is_deleted', false)
    .single()

  if (fetchError || !usuario) return { error: 'Usuario no encontrado' }

  // Soft delete en tabla usuarios
  const { error: updateError } = await supabase
    .from('usuarios')
    .update({ is_deleted: true, activo: false, deleted_at: new Date().toISOString() })
    .eq('id', usuarioId)
    .eq('tenant_id', tenantId)

  if (updateError) return { error: 'Error al eliminar el usuario. Intentalo nuevamente.' }

  // Eliminar el auth user para que no pueda loguear más
  const adminClient = createAdminClient()
  if (usuario.auth_user_id) {
    await adminClient.auth.admin.deleteUser(usuario.auth_user_id)
  }

  return { error: null }
}

export async function deleteTenantOwner(tenantId: string) {
  const { error: authError, supabase } = await assertOwner()
  if (authError || !supabase) return { error: authError }

  // 1. Proteger tenant sistema
  const { data: tenant, error: fetchError } = await supabase
    .from('tenants')
    .select('id, slug, nombre')
    .eq('id', tenantId)
    .single()

  if (fetchError || !tenant) return { error: 'Lomitería no encontrada' }
  if (!canPurgeTenant(tenant)) return { error: 'Esta lomitería no puede eliminarse' }

  // 2. Obtener todos los auth_user_id de usuarios del tenant
  const { data: usuarios } = await supabase
    .from('usuarios')
    .select('auth_user_id')
    .eq('tenant_id', tenantId)
    .not('auth_user_id', 'is', null)

  // 3. Eliminar cuentas de autenticación primero
  const adminClient = createAdminClient()
  if (usuarios && usuarios.length > 0) {
    for (const usuario of usuarios) {
      if (usuario.auth_user_id) {
        await adminClient.auth.admin.deleteUser(usuario.auth_user_id)
      }
    }
  }

  // 4. Hard delete del tenant (CASCADE eliminará las 18 tablas relacionadas)
  const { error: deleteError } = await supabase
    .from('tenants')
    .delete()
    .eq('id', tenantId)

  if (deleteError) {
    return { error: 'Error al eliminar la lomitería. Inténtalo nuevamente.' }
  }

  return { error: null }
}

// ─── Gestión de configuración de impresoras ─────────────────────────────────

export interface CreatePrinterConfigData {
  printer_id: string
  agent_ip: string
  agent_port: number
  tipo_impresora: 'usb' | 'network' | 'bluetooth'
  nombre_impresora?: string
  ubicacion?: string
  activo: boolean
}

export interface UpdatePrinterConfigData {
  printer_id?: string
  agent_ip?: string
  agent_port?: number
  tipo_impresora?: 'usb' | 'network' | 'bluetooth'
  nombre_impresora?: string
  ubicacion?: string
  activo?: boolean
}

/**
 * Obtiene la configuración de impresora de un tenant.
 */
export async function getPrinterConfigOwner(tenantId: string) {
  const { error: authError } = await assertOwner()
  if (authError) return { error: authError, config: null }

  // Service role: el owner gestiona cualquier tenant; con RLS el JWT no coincide con lomiteria_id.
  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('printer_config')
    .select('*')
    .eq('lomiteria_id', tenantId)
    .maybeSingle()

  if (error) {
    console.error('[getPrinterConfigOwner] Error:', error)
    return { error: 'Error al cargar configuración de impresora', config: null }
  }

  return { error: null, config: data }
}

/**
 * Crea o actualiza la configuración de impresora de un tenant.
 * Usa UPSERT para evitar conflictos.
 */
export async function upsertPrinterConfig(tenantId: string, data: CreatePrinterConfigData) {
  const { error: authError } = await assertOwner()
  if (authError) return { error: authError }

  if (!data.printer_id.trim()) return { error: 'El ID de impresora es requerido' }
  if (!data.agent_ip.trim()) return { error: 'La IP del agente es requerida' }
  if (!data.agent_port || data.agent_port <= 0) return { error: 'El puerto debe ser mayor a 0' }
  if (data.agent_port > 65535) return { error: 'El puerto debe ser menor a 65536' }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('printer_config')
    .upsert({
      lomiteria_id: tenantId,
      printer_id: data.printer_id.trim(),
      agent_ip: data.agent_ip.trim(),
      agent_port: data.agent_port,
      tipo_impresora: data.tipo_impresora,
      nombre_impresora: data.nombre_impresora?.trim() || null,
      ubicacion: data.ubicacion?.trim() || null,
      activo: data.activo,
    }, { onConflict: 'lomiteria_id' })

  if (error) {
    console.error('[upsertPrinterConfig] Error:', error)
    return { error: 'Error al guardar configuración de impresora. Intentalo nuevamente.' }
  }

  return { error: null }
}

/**
 * Actualiza campos específicos de la configuración de impresora.
 */
export async function updatePrinterConfig(tenantId: string, data: UpdatePrinterConfigData) {
  const { error: authError } = await assertOwner()
  if (authError) return { error: authError }

  const adminClient = createAdminClient()
  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (data.printer_id !== undefined) {
    if (!data.printer_id.trim()) return { error: 'El ID de impresora es requerido' }
    updatePayload.printer_id = data.printer_id.trim()
  }
  if (data.agent_ip !== undefined) {
    if (!data.agent_ip.trim()) return { error: 'La IP del agente es requerida' }
    updatePayload.agent_ip = data.agent_ip.trim()
  }
  if (data.agent_port !== undefined) {
    if (data.agent_port <= 0) return { error: 'El puerto debe ser mayor a 0' }
    if (data.agent_port > 65535) return { error: 'El puerto debe ser menor a 65536' }
    updatePayload.agent_port = data.agent_port
  }
  if (data.tipo_impresora !== undefined) updatePayload.tipo_impresora = data.tipo_impresora
  if (data.nombre_impresora !== undefined) updatePayload.nombre_impresora = data.nombre_impresora?.trim() || null
  if (data.ubicacion !== undefined) updatePayload.ubicacion = data.ubicacion?.trim() || null
  if (data.activo !== undefined) updatePayload.activo = data.activo

  const { error } = await adminClient
    .from('printer_config')
    .update(updatePayload)
    .eq('lomiteria_id', tenantId)

  if (error) {
    console.error('[updatePrinterConfig] Error:', error)
    return { error: 'Error al actualizar configuración de impresora. Intentalo nuevamente.' }
  }

  return { error: null }
}

/**
 * Elimina la configuración de impresora de un tenant.
 */
export async function deletePrinterConfig(tenantId: string) {
  const { error: authError } = await assertOwner()
  if (authError) return { error: authError }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('printer_config')
    .delete()
    .eq('lomiteria_id', tenantId)

  if (error) {
    console.error('[deletePrinterConfig] Error:', error)
    return { error: 'Error al eliminar configuración de impresora. Intentalo nuevamente.' }
  }

  return { error: null }
}
