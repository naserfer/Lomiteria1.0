'use client'

import { formatGuaranies } from '@/shared/utils/format'

interface Product {
  id: string
  nombre: string
  descripcion?: string
  precio: number
  disponible: boolean
}

interface Props {
  products: Product[]
  onAddProduct: (product: Product) => void
  loading?: boolean
  darkMode?: boolean
}

export default function ProductGrid({ products, onAddProduct, loading, darkMode }: Props) {
  if (loading) {
    return (
      <div className={`rounded-2xl shadow-lg p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <h2 className={`text-2xl font-bold mb-6 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Productos</h2>
        <div className="text-center py-12 text-gray-500">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent mb-4"></div>
          <p>Cargando productos...</p>
        </div>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className={`rounded-2xl shadow-lg p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <h2 className={`text-2xl font-bold mb-6 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Productos</h2>
        <div className={`text-center py-12 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          <div className="text-5xl mb-4">📦</div>
          <p>No hay productos en esta categoría</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl shadow-lg p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
      <h2 className={`text-2xl font-bold mb-6 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
        Productos ({products.length})
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {products.map((product) => (
          <button
            key={product.id}
            onClick={() => onAddProduct(product)}
            className={`group relative p-5 rounded-2xl border-2 hover:border-orange-400 hover:shadow-xl transition-all duration-300 transform hover:scale-105 text-left overflow-hidden ${
              darkMode
                ? 'bg-gradient-to-br from-gray-700 to-gray-800 border-gray-600'
                : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'
            }`}
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-orange-100 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-500"></div>
            
            <div className="relative">
              <div className={`font-bold mb-2 group-hover:text-orange-600 transition-colors ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}>
                {product.nombre}
              </div>
              {product.descripcion && (
                <div className={`text-xs mb-3 line-clamp-2 ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {product.descripcion}
                </div>
              )}
              <div className="text-2xl font-bold text-orange-600">
                {formatGuaranies(product.precio)}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

