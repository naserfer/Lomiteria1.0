'use client'

import Link from 'next/link'
import { useAuth } from '../hooks/useAuth'
import { LoginHeader } from '../components/LoginHeader'
import { ErrorAlert } from '../components/ErrorAlert'
import { LoginFields } from '../components/LoginFields'
import { LoginButton } from '../components/LoginButton'
import { DevCredentials } from '../components/DevCredentials'
import { OAuthButtons } from '../components/OAuthButtons'
import { ROUTES } from '@/config/routes'

export default function LoginForm() {
  const {
    email,
    setEmail,
    password,
    setPassword,
    loading,
    error,
    handleLogin
  } = useAuth()

  return (
    <div className="flex items-center justify-center min-h-full px-4 py-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden">
        <div className="grid md:grid-cols-2 gap-0 relative">
          {/* Sección izquierda - Header */}
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-8 md:p-12 flex items-center justify-center">
            <LoginHeader />
          </div>
          
          {/* Separador sutil - solo visible en desktop */}
          <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gray-200 -translate-x-1/2"></div>
          
          {/* Sección derecha - Form */}
          <div className="p-8 md:p-12 flex flex-col justify-center">
            <OAuthButtons />

            <div className="my-5" />

            <form onSubmit={handleLogin} className="space-y-6">
              <ErrorAlert message={error} />
              
              <LoginFields
                email={email}
                password={password}
                onEmailChange={setEmail}
                onPasswordChange={setPassword}
                disabled={loading}
              />
              
              <LoginButton loading={loading} />
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              ¿No tenés cuenta?{' '}
              <Link href={ROUTES.PUBLIC.SIGNUP} className="text-orange-600 hover:text-orange-700 font-medium">
                Creá una gratis
              </Link>
            </p>

            <DevCredentials />
          </div>
        </div>
      </div>
    </div>
  )
}
