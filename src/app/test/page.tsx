'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase, testConnection } from '@/core/supabase'

export default function TestPage() {
  const [connectionStatus, setConnectionStatus] = useState<any>(null)
  const [productos, setProductos] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function testSupabase() {
      try {
        // Test de conexión
        const conn = await testConnection()
        setConnectionStatus(conn)

        // Traer productos
        const { data: prods, error: errorProds } = await supabase
          .from('productos')
          .select('*')
          .limit(5)
        
        if (!errorProds) setProductos(prods || [])

        // Traer categorías
        const { data: cats, error: errorCats } = await supabase
          .from('categorias')
          .select('*')
        
        if (!errorCats) setCategorias(cats || [])

      } catch (error) {
        console.error('Error:', error)
        setConnectionStatus({ success: false, error: String(error) })
      } finally {
        setLoading(false)
      }
    }

    testSupabase()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-2xl">Testeando conexión con Supabase...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-4xl font-bold">🧪 Test de Supabase</h1>

        {/* Estado de conexión */}
        <div className={`p-6 rounded-lg ${connectionStatus?.success ? 'bg-green-100 border-2 border-green-500' : 'bg-red-100 border-2 border-red-500'}`}>
          <h2 className="text-2xl font-semibold mb-2">
            {connectionStatus?.success ? '✅ Conexión Exitosa' : '❌ Error de Conexión'}
          </h2>
          <p className="text-lg">{connectionStatus?.message}</p>
          {connectionStatus?.error && (
            <pre className="mt-4 p-4 bg-white rounded overflow-auto">
              {JSON.stringify(connectionStatus.error, null, 2)}
            </pre>
          )}
        </div>

        {/* Categorías */}
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold mb-4">
            📂 Categorías ({categorias.length})
          </h2>
          <div className="space-y-2">
            {categorias.map((cat) => (
              <div key={cat.id} className="p-3 bg-blue-50 rounded">
                <div className="font-semibold">{cat.nombre}</div>
                <div className="text-sm text-gray-600">Orden: {cat.orden}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Productos */}
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold mb-4">
            🍔 Productos (primeros 5 de {productos.length})
          </h2>
          <div className="space-y-2">
            {productos.map((prod) => (
              <div key={prod.id} className="p-3 bg-green-50 rounded flex justify-between">
                <div>
                  <div className="font-semibold">{prod.nombre}</div>
                  <div className="text-sm text-gray-600">{prod.descripcion}</div>
                </div>
                <div className="text-lg font-bold text-green-600">
                  ${prod.precio}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info de configuración */}
        <div className="bg-gray-100 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">🔧 Configuración</h2>
          <div className="space-y-2 font-mono text-sm">
            <div>
              <span className="font-semibold">URL:</span>{' '}
              {process.env.NEXT_PUBLIC_SUPABASE_URL || '❌ No configurada'}
            </div>
            <div>
              <span className="font-semibold">Key:</span>{' '}
              {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY 
                ? '✅ Configurada' 
                : '❌ No configurada'}
            </div>
          </div>
        </div>

        <div className="text-center">
          <Link 
            href="/" 
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Volver al Inicio
          </Link>
        </div>
      </div>
    </div>
  )
}


