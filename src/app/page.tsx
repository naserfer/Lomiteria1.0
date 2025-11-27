'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ShoppingCart, BarChart3, Loader2 } from 'lucide-react'
import { useTenant } from '@/features/auth/TenantContext'

export default function Home() {
  const router = useRouter()
  const { tenant, usuario, darkMode, loading, user } = useTenant()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [loading, user, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-500 to-orange-600">
        <div className="text-center text-white">
          <Loader2 className="h-16 w-16 animate-spin mx-auto mb-4" />
          <p className="text-xl font-semibold">Verificando sesión...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="space-y-16 py-4">
      <section className="text-center space-y-4">
        <div
          className={`inline-flex items-center gap-3 px-4 py-2 rounded-full text-sm font-semibold ${
            darkMode ? 'bg-gray-800 text-orange-300' : 'bg-orange-100 text-orange-700'
          }`}
        >
          <span>Operando: {tenant?.nombre ?? 'Ka\'u Manager'}</span>
          {usuario && <span>• Usuario: {usuario.nombre}</span>}
        </div>
        <h1 className={`text-5xl md:text-6xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Sistema de Gestión
        </h1>
        <p className={`text-lg md:text-xl max-w-2xl mx-auto ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          Control total de tu lomitería: ventas, pedidos y reportes en tiempo real.
        </p>
      </section>

      <section className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        <Link
          href="/pos"
          className={`group relative overflow-hidden rounded-3xl shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-orange-500/20 ${
            darkMode ? 'bg-gradient-to-br from-gray-800 to-gray-900' : 'bg-gradient-to-br from-white to-orange-50'
          }`}
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/10 rounded-full -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-500" />
          <div className="relative p-8 space-y-4">
            <div className={`inline-flex p-4 rounded-2xl ${darkMode ? 'bg-orange-500/20' : 'bg-orange-100'}`}>
              <ShoppingCart className={`w-8 h-8 ${darkMode ? 'text-orange-400' : 'text-orange-600'}`} />
            </div>
            <div>
              <h3 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Punto de Venta</h3>
              <p className={`text-base leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Toma pedidos rápido, controla clientes y suma puntos automáticamente.
              </p>
            </div>
            <span className={`inline-flex items-center gap-1 text-sm font-semibold ${darkMode ? 'text-orange-400' : 'text-orange-600'}`}>
              Ingresar al POS →
            </span>
          </div>
          <div className={`absolute bottom-0 left-0 right-0 h-2 ${darkMode ? 'bg-orange-500/50' : 'bg-orange-500'}`} />
        </Link>

        <Link
          href="/admin"
          className={`group relative overflow-hidden rounded-3xl shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-blue-500/20 ${
            darkMode ? 'bg-gradient-to-br from-gray-800 to-gray-900' : 'bg-gradient-to-br from-white to-blue-50'
          }`}
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-500" />
          <div className="relative p-8 space-y-4">
            <div className={`inline-flex p-4 rounded-2xl ${darkMode ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
              <BarChart3 className={`w-8 h-8 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
            <div>
              <h3 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Administración</h3>
              <p className={`text-base leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Panel con ventas, inventario, fidelización y cierres de caja.
              </p>
            </div>
            <span className={`inline-flex items-center gap-1 text-sm font-semibold ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
              Ver panel admin →
            </span>
          </div>
          <div className={`absolute bottom-0 left-0 right-0 h-2 ${darkMode ? 'bg-blue-500/50' : 'bg-blue-500'}`} />
        </Link>
      </section>

      <section className="max-w-5xl mx-auto">
        <div
          className={`grid grid-cols-1 md:grid-cols-3 gap-6 p-8 rounded-2xl ${
            darkMode ? 'bg-gray-800/50' : 'bg-white/70'
          } backdrop-blur-sm`}
        >
          {[
            { icon: '⚡', title: 'Rápido y Eficiente', desc: 'Tomá pedidos en segundos.' },
            { icon: '⭐', title: 'Puntos de Fidelidad', desc: 'Premiá a tus clientes frecuentes.' },
            { icon: '📊', title: 'Reportes Detallados', desc: 'Analizá ventas en tiempo real.' }
          ].map((feature) => (
            <div key={feature.title} className="text-center space-y-2">
              <div className={`text-3xl mb-2 ${darkMode ? 'text-orange-400' : 'text-orange-600'}`}>{feature.icon}</div>
              <h4 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{feature.title}</h4>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className={`text-center text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
        <p>Powered by Next.js 15 • TypeScript • Supabase</p>
      </footer>
    </div>
  )
}


