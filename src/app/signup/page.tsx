import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SignUpForm from '@/features/auth/view/SignUpForm'
import { getPostLoginRoute } from '@/config'
import type { UserRole } from '@/config/routing'

export default async function SignUpPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Si ya hay sesión, redirigir según el rol
  if (user) {
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('auth_user_id', user.id)
      .single()

    if (usuario?.rol) {
      const defaultRoute = getPostLoginRoute(usuario.rol as UserRole)
      redirect(defaultRoute)
    } else {
      redirect('/home')
    }
  }

  return <SignUpForm />
}
