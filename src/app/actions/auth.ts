'use server'

import { createClient } from '@/lib/supabase/server'
import { getPostLoginRoute } from '@/config'
import { ROUTES } from '@/config/routes'
import { buildTenantSlug, createDefaultCategories } from '@/lib/auth/tenantInit'
import type { UserRole } from '@/config/routing'

/**
 * Server Action para iniciar sesión
 * IMPORTANTE: No redirige aquí, retorna la ruta para que el cliente haga window.location.href
 * Esto es necesario con @supabase/ssr para sincronizar cookies correctamente
 */
export async function signIn(email: string, password: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  // Obtener el rol del usuario para determinar la ruta
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('auth_user_id', user.id)
      .single()

    if (usuario?.rol) {
      const defaultRoute = getPostLoginRoute(usuario.rol as UserRole)
      return { success: true, redirectTo: defaultRoute }
    }
  }

  return { success: true, redirectTo: '/home' }
}

/**
 * Server Action para registrar una nueva cuenta de negocio
 * Crea el usuario en Supabase Auth, el tenant y el usuario administrador
 */
export async function signUp(
  nombre: string,
  nombreNegocio: string,
  email: string,
  password: string
) {
  const supabase = await createClient()

  // 1. Crear usuario en Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nombre,
        nombre_negocio: nombreNegocio,
      },
    },
  })

  if (authError) {
    return { success: false, error: authError.message }
  }

  if (!authData.user) {
    return { success: false, error: 'No se pudo crear el usuario' }
  }

  // 2. Generar slug único para el tenant a partir del nombre del negocio
  const slug = buildTenantSlug(nombreNegocio, authData.user.id)

  // 3. Crear el tenant (negocio)
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      nombre: nombreNegocio,
      slug,
      email,
      activo: true,
    })
    .select('id')
    .single()

  if (tenantError || !tenant) {
    return { success: false, error: 'Error al crear el negocio. Intenta de nuevo.' }
  }

  // 4. Crear el usuario administrador vinculado al tenant
  const { error: usuarioError } = await supabase
    .from('usuarios')
    .insert({
      tenant_id: tenant.id,
      auth_user_id: authData.user.id,
      email,
      nombre,
      rol: 'admin',
      activo: true,
    })

  if (usuarioError) {
    return { success: false, error: 'Error al configurar el perfil de usuario.' }
  }

  // 5. Crear categorías por defecto para el nuevo tenant
  await createDefaultCategories(supabase, tenant.id)

  // Si el email necesita confirmación (Supabase puede requerir verificación)
  if (!authData.session) {
    return {
      success: true,
      requiresEmailConfirmation: true,
      message: 'Cuenta creada. Revisa tu correo para confirmar tu cuenta.',
    }
  }

  return { success: true, redirectTo: getPostLoginRoute('admin') }
}

/**
 * Server Action para obtener la URL de OAuth (Google / Apple)
 * El cliente abre esta URL en el navegador para iniciar el flujo OAuth
 */
export async function getOAuthUrl(provider: 'google' | 'apple') {
  const supabase = await createClient()

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : 'http://localhost:3000'

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}${ROUTES.PUBLIC.AUTH_CALLBACK}`,
      skipBrowserRedirect: true,
    },
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, url: data.url }
}

/**
 * Server Action para cerrar sesión
 * Retorna success para que el cliente haga window.location.href
 */
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  
  return { success: true }
}
