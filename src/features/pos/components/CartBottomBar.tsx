'use client'

import { createPortal } from 'react-dom'
import { useCartStore } from '@/store/cartStore'
import { formatGuaranies } from '@/lib/utils/format'
import { ShoppingCart, ChevronUp, ChevronDown } from 'lucide-react'
import { CART_SECTION_ID, POS_PRODUCTS_SECTION_ID } from './ScrollToCartFAB'
import { useCartSectionVisible } from '../hooks/useCartSectionVisible'

interface Props {
  darkMode?: boolean
}

export function CartBottomBar({ darkMode }: Props) {
  const { items, getTotal } = useCartStore()
  const itemCount = items.reduce((sum, item) => sum + item.cantidad, 0)
  const total = getTotal()
  const isCartVisible = useCartSectionVisible()

  const scrollToCart = () => {
    const el = document.getElementById(CART_SECTION_ID)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const scrollToProducts = () => {
    const el = document.getElementById(POS_PRODUCTS_SECTION_ID)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (itemCount === 0) return null

  const bar = (
    <div
      className={`
        lg:hidden fixed bottom-0 left-0 right-0 z-40
        flex items-center justify-between gap-3 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]
        shadow-[0_-4px_20px_rgba(0,0,0,0.15)]
        border-t
        ${darkMode
          ? 'bg-gray-800 border-gray-700'
          : 'bg-white border-gray-200'
        }
      `}
      role="status"
      aria-live="polite"
      aria-label={`Carrito: ${itemCount} ${itemCount === 1 ? 'ítem' : 'ítems'}, total ${formatGuaranies(total)}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${darkMode ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600'}`}>
          <ShoppingCart className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Items: {itemCount}
          </p>
          <p className={`text-xs font-medium ${darkMode ? 'text-orange-400' : 'text-orange-600'}`}>
            Total: {formatGuaranies(total)}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={isCartVisible ? scrollToProducts : scrollToCart}
        aria-label={isCartVisible ? 'Agregar más productos' : `Ver carrito y finalizar pedido (${itemCount} ${itemCount === 1 ? 'ítem' : 'ítems'})`}
        className={`
          flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5
          text-sm font-semibold text-white
          shadow-md transition-all active:scale-[0.98]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-400
          min-h-[44px]
          ${darkMode
            ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-orange-500/25'
            : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-orange-600/30'
          }
        `}
      >
        <span>{isCartVisible ? 'Agregar más productos' : 'Ver carrito'}</span>
        {isCartVisible ? (
          <ChevronUp className="h-4 w-4" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(bar, document.body)
}
