import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPostLoginRoute } from '@/config'
import { ROUTES } from '@/config/routes'
import { buildTenantSlug, createDefaultCategories } from '@/lib/auth/tenantInit'
import type { UserRole } from '@/config/routing'

/**
 * Callback de OAuth (Google / Apple)
 * Supabase redirige aquí luego del flujo OAuth con un código de autorización.
 * Intercambiamos el código por una sesión, verificamos/creamos el tenant
 * y redirigimos al usuario a la ruta correcta.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? ROUTES.PROTECTED.HOME

  if (!code) {
    return NextResponse.redirect(`${origin}${ROUTES.PUBLIC.LOGIN}?error=missing_code`)
  }

  const supabase = await createClient()

  // Intercambiar el código por una sesión
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    return NextResponse.redirect(
      `${origin}${ROUTES.PUBLIC.LOGIN}?error=${encodeURIComponent(exchangeError.message)}`
    )
  }

  // Obtener el usuario autenticado
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}${ROUTES.PUBLIC.LOGIN}?error=no_user`)
  }

  // Verificar si el usuario ya tiene un registro en la tabla usuarios
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id, rol, tenant_id')
    .eq('auth_user_id', user.id)
    .eq('is_deleted', false)
    .single()

  if (usuario) {
    // Usuario existente: redirigir según su rol
    const redirectRoute = getPostLoginRoute(usuario.rol as UserRole)
    return NextResponse.redirect(`${origin}${redirectRoute}`)
  }

  // Usuario nuevo (OAuth por primera vez): crear tenant y usuario admin
  const nombreNegocio = user.user_metadata?.nombre_negocio || 'Mi Negocio'
  const nombre =
    user.user_metadata?.nombre ||
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    'Usuario'

  const slug = buildTenantSlug(nombreNegocio, user.id)

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      nombre: nombreNegocio,
      slug,
      email: user.email,
      activo: true,
    })
    .select('id')
    .single()

  if (tenantError || !tenant) {
    return NextResponse.redirect(
      `${origin}${ROUTES.PUBLIC.LOGIN}?error=tenant_creation_failed`
    )
  }

  await supabase.from('usuarios').insert({
    tenant_id: tenant.id,
    auth_user_id: user.id,
    email: user.email,
    nombre,
    rol: 'admin',
    activo: true,
  })

  await createDefaultCategories(supabase, tenant.id)

  return NextResponse.redirect(`${origin}${next}`)
}
