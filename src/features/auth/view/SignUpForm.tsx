'use client'

import Link from 'next/link'
import { useSignUp } from '../hooks/useSignUp'
import { ErrorAlert } from '../components/ErrorAlert'
import { SignUpFields } from '../components/SignUpFields'
import { OAuthButtons } from '../components/OAuthButtons'
import { ROUTES } from '@/config/routes'

export default function SignUpForm() {
  const {
    nombre,
    setNombre,
    nombreNegocio,
    setNombreNegocio,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    loading,
    error,
    successMessage,
    handleSignUp,
  } = useSignUp()

  return (
    <div className="flex items-center justify-center min-h-full px-4 py-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden">
        <div className="grid md:grid-cols-2 gap-0 relative">
          {/* Sección izquierda - Header */}
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-8 md:p-12 flex flex-col items-center justify-center text-center">
            <div className="text-6xl mb-4">🍔</div>
            <h1 className="text-3xl font-bold text-white mb-2">LomiPos</h1>
            <p className="text-white/70 mb-6">La solución para tu negocio.</p>
            <ul className="space-y-3 text-left w-full">
              <li className="flex items-center gap-2 text-white/90 text-sm">
                <span>⚡</span>
                <span><strong>Rápido y Eficiente</strong> – Tomá pedidos en segundos.</span>
              </li>
              <li className="flex items-center gap-2 text-white/90 text-sm">
                <span>📊</span>
                <span><strong>Reportes Detallados</strong> – Analizá ventas en tiempo real.</span>
              </li>
              <li className="flex items-center gap-2 text-white/90 text-sm">
                <span>📦</span>
                <span><strong>Inventario Automático</strong> – Control de stock inteligente.</span>
              </li>
            </ul>
          </div>

          {/* Separador sutil - solo visible en desktop */}
          <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gray-200 -translate-x-1/2" />

          {/* Sección derecha - Form */}
          <div className="p-8 md:p-12 flex flex-col justify-center overflow-y-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Crear cuenta</h2>
              <p className="text-gray-500 text-sm mt-1">Registrá tu negocio y empezá gratis</p>
            </div>

            {successMessage ? (
              <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-4 rounded-lg text-sm">
                <p className="font-medium mb-1">¡Cuenta creada exitosamente!</p>
                <p>{successMessage}</p>
                <Link
                  href={ROUTES.PUBLIC.LOGIN}
                  className="mt-3 inline-block text-green-700 underline font-medium"
                >
                  Ir al inicio de sesión
                </Link>
              </div>
            ) : (
              <>
                <OAuthButtons />

                <div className="my-5" />

                <form onSubmit={handleSignUp} className="space-y-4">
                  <ErrorAlert message={error} />

                  <SignUpFields
                    nombre={nombre}
                    nombreNegocio={nombreNegocio}
                    email={email}
                    password={password}
                    confirmPassword={confirmPassword}
                    onNombreChange={setNombre}
                    onNombreNegocioChange={setNombreNegocio}
                    onEmailChange={setEmail}
                    onPasswordChange={setPassword}
                    onConfirmPasswordChange={setConfirmPassword}
                    disabled={loading}
                  />

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center">
                        <svg
                          className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Creando cuenta...
                      </span>
                    ) : (
                      'Crear cuenta'
                    )}
                  </button>
                </form>
              </>
            )}

            <p className="mt-6 text-center text-sm text-gray-500">
              ¿Ya tenés cuenta?{' '}
              <Link href={ROUTES.PUBLIC.LOGIN} className="text-orange-600 hover:text-orange-700 font-medium">
                Iniciá sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
