'use client'

import { Plus, Star } from 'lucide-react'
import { formatGuaranies } from '@/lib/utils/format'
import type { Producto } from '../types/pos.types'
import { useCartStore } from '@/store/cartStore'

interface Props {
  products: Producto[]
  onAddProduct: (product: Producto) => void
  loading?: boolean
  /** Mientras es true, no se puede agregar al carrito (ej. verificando estado de caja) */
  verificandoCaja?: boolean
  darkMode?: boolean
  /** Si true, no muestra el título "Productos (N)" (útil en subsecciones con nombre de categoría) */
  hideTitle?: boolean
}

function isCombo(product: Producto): boolean {
  return Boolean(product.combo_items && product.combo_items.length > 0)
}

export default function ProductGrid({ products, onAddProduct, loading, verificandoCaja, darkMode, hideTitle }: Props) {
  const { items, updateQuantity } = useCartStore()
  const canAdd = !verificandoCaja
  const getSelectedQty = (product: Producto) => {
    const targetTipo = isCombo(product) ? 'combo' : 'producto'
    return items
      .filter((it) => it.producto_id === product.id && it.tipo === targetTipo && it.modo !== 'canje')
      .reduce((sum, it) => sum + it.cantidad, 0)
  }
  const decrementProduct = (product: Producto) => {
    const targetTipo = isCombo(product) ? 'combo' : 'producto'
    const linked = items.find((it) => it.producto_id === product.id && it.tipo === targetTipo && it.modo !== 'canje')
    if (!linked) return
    updateQuantity(linked.id, linked.cantidad - 1)
  }
  if (loading) {
    return (
      <div className={`rounded-2xl shadow-lg p-4 sm:p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <h2 className={`text-lg sm:text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Productos</h2>
        <div className="text-center py-12 text-gray-500">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-orange-500 border-t-transparent mb-3"></div>
          <p className="text-sm">Cargando productos...</p>
        </div>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className={`rounded-2xl shadow-lg p-4 sm:p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <h2 className={`text-lg sm:text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Productos</h2>
        <div className={`text-center py-10 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          <div className="text-4xl mb-3">📦</div>
          <p className="text-sm">No hay productos en esta categoría</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl shadow-lg p-3 sm:p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
      {!hideTitle && (
        <h2 className={`text-lg sm:text-2xl font-bold mb-3 sm:mb-6 px-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Productos <span className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>({products.length})</span>
          {verificandoCaja && (
            <span className={`ml-2 text-xs font-normal ${darkMode ? 'text-orange-400' : 'text-orange-600'}`}>
              Verificando caja…
            </span>
          )}
        </h2>
      )}

      {/* Mobile: lista compacta de filas */}
      <div className="flex flex-col gap-1.5 sm:hidden">
        {products.map((product) => {
          const selectedQty = getSelectedQty(product)
          return (
            <div
              key={product.id}
              role="button"
              tabIndex={0}
              onClick={() => canAdd && onAddProduct(product)}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && canAdd) {
                  e.preventDefault()
                  onAddProduct(product)
                }
              }}
              title={!canAdd ? 'Verificando estado de caja...' : undefined}
              className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors active:scale-[0.98] ${
                !canAdd
                  ? 'cursor-not-allowed opacity-70'
                  : darkMode
                    ? 'bg-gray-700/50 active:bg-gray-600'
                    : 'bg-gray-50 active:bg-orange-50'
              } ${
                selectedQty > 0
                  ? darkMode
                    ? 'border-orange-400 ring-1 ring-orange-400/40'
                    : 'border-orange-400 ring-1 ring-orange-300/60'
                  : darkMode
                    ? 'border-gray-600'
                    : 'border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-sm font-semibold truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {product.nombre}
                    </span>
                    {isCombo(product) && (
                      <span className="flex-shrink-0 rounded bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold text-purple-700 dark:bg-purple-500/20 dark:text-purple-300">
                        COMBO
                      </span>
                    )}
                    {(product.puntos_extra ?? 0) > 0 && (
                      <span className="flex-shrink-0 inline-flex items-center gap-0.5 rounded bg-yellow-100 px-1.5 py-0.5 text-[9px] font-bold text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300">
                        <Star size={8} className="fill-current" />
                        +{product.puntos_extra} pts
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-bold text-orange-600 whitespace-nowrap">
                    {formatGuaranies(product.precio)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {selectedQty > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          decrementProduct(product)
                        }}
                        className={`h-8 w-8 rounded-full border text-sm font-bold ${
                          darkMode
                            ? 'border-gray-500 bg-gray-700 text-gray-200'
                            : 'border-gray-300 bg-white text-gray-700'
                        }`}
                        aria-label={`Restar ${product.nombre}`}
                      >
                        -
                      </button>
                      <span className={`min-w-[1.5rem] text-center text-sm font-bold ${darkMode ? 'text-orange-300' : 'text-orange-700'}`}>
                        {selectedQty}
                      </span>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      canAdd && onAddProduct(product)
                    }}
                    className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      darkMode ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600'
                    }`}
                    aria-label={`Agregar ${product.nombre}`}
                  >
                    <Plus size={16} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Tablet / Desktop: grid de cards */}
      <div className="hidden sm:grid sm:grid-cols-2 md:grid-cols-3 gap-3">
        {products.map((product) => {
          const selectedQty = getSelectedQty(product)
          return (
          <div
            key={product.id}
            role="button"
            tabIndex={0}
            onClick={() => canAdd && onAddProduct(product)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && canAdd) {
                e.preventDefault()
                onAddProduct(product)
              }
            }}
            title={!canAdd ? 'Verificando estado de caja...' : undefined}
            className={`group relative overflow-hidden rounded-xl border p-4 text-left transition-all duration-200 ${
              !canAdd
                ? 'cursor-not-allowed border-gray-400/50 opacity-70'
                : `hover:border-orange-400 hover:shadow-lg ${
                    darkMode
                      ? 'border-gray-600 bg-gray-700/60 hover:bg-gray-700'
                      : 'border-gray-200 bg-white hover:bg-orange-50/40'
                  }`
            } ${
              selectedQty > 0
                ? darkMode
                  ? 'border-orange-400 ring-1 ring-orange-400/40'
                  : 'border-orange-500 ring-2 ring-orange-200'
                : ''
            }`}
          >
            {isCombo(product) && (
              <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300">
                COMBO
              </span>
            )}
            {!isCombo(product) && (product.puntos_extra ?? 0) > 0 && (
              <span className="absolute top-2 right-2 inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300">
                <Star size={8} className="fill-current" />
                +{product.puntos_extra} pts
              </span>
            )}
            <div className={`font-semibold text-sm mb-1 group-hover:text-orange-600 transition-colors ${
              darkMode ? 'text-white' : 'text-gray-900'
            }`}>
              {product.nombre}
            </div>
            {isCombo(product) ? (
              <div className={`text-[10px] mb-2 space-y-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {product.combo_items!.map((ci) => (
                  <div key={ci.producto_id}>- {ci.producto.nombre}{ci.cantidad > 1 ? ` x${ci.cantidad}` : ''}</div>
                ))}
              </div>
            ) : product.descripcion ? (
              <div className={`text-xs mb-2 line-clamp-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {product.descripcion}
              </div>
            ) : null}
            {selectedQty > 0 && (
              <div className={`mb-2 inline-flex rounded-lg px-2 py-0.5 text-xs font-bold ${
                darkMode ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-100 text-orange-700'
              }`}>
                En pedido: {selectedQty}
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-orange-600">
                {formatGuaranies(product.precio)}
              </span>
              <div className="flex items-center gap-1.5">
                {selectedQty > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        decrementProduct(product)
                      }}
                      className={`h-7 w-7 rounded-full border text-sm font-bold ${
                        darkMode
                          ? 'border-gray-500 bg-gray-700 text-gray-200'
                          : 'border-gray-300 bg-white text-gray-700'
                      }`}
                      aria-label={`Restar ${product.nombre}`}
                    >
                      -
                    </button>
                    <span className={`min-w-[1.25rem] text-center text-xs font-bold ${darkMode ? 'text-orange-300' : 'text-orange-700'}`}>
                      {selectedQty}
                    </span>
                  </>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    canAdd && onAddProduct(product)
                  }}
                  className={`h-7 w-7 rounded-full flex items-center justify-center ${
                    darkMode ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600'
                  } ${selectedQty > 0 ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'} transition-opacity`}
                  aria-label={`Agregar ${product.nombre}`}
                >
                  <Plus size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        )})}
      </div>
    </div>
  )
}
