'use client'

import { useCartStore, type CartItem } from '../cartStore'
import { Trash2, Plus, Minus, ShoppingBag, Settings2 } from 'lucide-react'
import { formatGuaranies } from '@/shared/utils/format'

type OrderTypeValue = 'delivery' | 'local' | 'para_llevar'

interface OrderTypeOption {
  value: OrderTypeValue
  label: string
  helper: string
  icon: string
  activeClass: string
}

const ORDER_TYPES: OrderTypeOption[] = [
  {
    value: 'delivery',
    label: 'Delivery',
    helper: 'Envío a domicilio',
    icon: '🏠',
    activeClass: 'bg-blue-600 text-white ring-2 ring-blue-200/70 border-blue-500/80 shadow-lg'
  },
  {
    value: 'local',
    label: 'Comer aquí',
    helper: 'Consumo en salón',
    icon: '🍽️',
    activeClass: 'bg-green-600 text-white ring-2 ring-green-200/70 border-green-500/80 shadow-lg'
  },
  {
    value: 'para_llevar',
    label: 'Para llevar',
    helper: 'El cliente retira',
    icon: '📦',
    activeClass: 'bg-orange-600 text-white ring-2 ring-orange-200/70 border-orange-500/80 shadow-lg'
  }
]

interface Props {
  onOpenClientModal: () => void
  onConfirmOrder: () => void
  isProcessing?: boolean
  darkMode?: boolean
  onEditItem?: (itemId: string) => void
}

export default function Cart({
  onOpenClientModal,
  onConfirmOrder,
  isProcessing,
  darkMode,
  onEditItem
}: Props) {
  const { items, cliente, tipo, removeItem, updateQuantity, getTotal, setTipo } = useCartStore()
  const orderTypeInactiveClasses = darkMode
    ? 'bg-gray-700/60 text-gray-200 border-gray-600 hover:bg-gray-600'
    : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
  const orderTypeFocusOffset = darkMode
    ? 'focus-visible:ring-offset-gray-800'
    : 'focus-visible:ring-offset-white'
  
  const total = getTotal()
  const itemCount = items.reduce((sum, item) => sum + item.cantidad, 0)

  return (
    <div className={`rounded-2xl shadow-2xl flex flex-col h-full max-h-full ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
      {/* Header fijo */}
      <div className="flex items-center gap-3 p-3 border-b flex-shrink-0">
        <ShoppingBag className="text-orange-600" size={20} />
        <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Pedido {itemCount > 0 && `(${itemCount})`}
        </h2>
      </div>

      {/* Lista de items - scrollable (max 3 items visibles) */}
      <div className="overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200" style={{ maxHeight: '420px', minHeight: '0' }}>
        {items.length === 0 ? (
          <div className={`text-center py-8 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            <div className="text-4xl mb-2">🛒</div>
            <p className="text-sm">Selecciona productos</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`rounded-lg p-3 border ${
                darkMode 
                  ? 'bg-gray-700/50 border-gray-600'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="mb-2">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className={`font-bold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {item.nombre}
                  </div>
                  <button
                    onClick={() => onEditItem?.(item.id)}
                    className={`text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-lg ${
                      darkMode
                        ? 'bg-gray-800 text-orange-200 hover:bg-gray-700'
                        : 'bg-white text-orange-600 border border-orange-200 hover:bg-orange-50'
                    }`}
                    title="Editar ingredientes"
                  >
                    <Settings2 size={12} />
                    Editar
                  </button>
                </div>
                {item.descripcion && (
                  <div className={`text-xs leading-relaxed mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {item.descripcion}
                  </div>
                )}
                {item.customization && (
                  <div className={`text-[11px] space-y-1 mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    {item.customization.extras.length > 0 && (
                      <p>
                        <span className="font-semibold text-green-500 mr-1">+ Extras:</span>
                        {item.customization.extras.map((extra) => `${extra.label} (${extra.quantityPerItem}${extra.unit})`).join(', ')}
                      </p>
                    )}
                    {item.customization.removedIngredients.length > 0 && (
                      <p>
                        <span className="font-semibold text-red-400 mr-1">- Sin:</span>
                        {item.customization.removedIngredients.map((ing) => ing.label).join(', ')}
                      </p>
                    )}
                  </div>
                )}
                <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {formatGuaranies(item.precio + (item.extraCostPerUnit ?? 0))} × {item.cantidad}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="text-base font-bold text-orange-600">
                  {formatGuaranies(item.subtotal)}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateQuantity(item.id, item.cantidad - 1)}
                    className={`p-1.5 rounded transition-colors ${
                      darkMode
                        ? 'bg-gray-600 hover:bg-gray-500'
                        : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                  >
                    <Minus size={12} />
                  </button>
                  <span className="w-8 text-center font-bold text-sm">{item.cantidad}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.cantidad + 1)}
                    className="p-1.5 bg-orange-100 text-orange-600 rounded hover:bg-orange-200 transition-colors"
                  >
                    <Plus size={12} />
                  </button>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors ml-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Sección fija inferior - siempre visible */}
      {items.length > 0 && (
        <div className={`flex-shrink-0 p-3 border-t space-y-2 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          {/* Cliente - compacto */}
          <button
            onClick={onOpenClientModal}
            className={`w-full p-2 rounded-lg border border-dashed transition-all text-left ${
              darkMode
                ? 'bg-gray-700/30 border-blue-500/50 hover:border-blue-400'
                : 'bg-blue-50/50 border-blue-300 hover:border-blue-500'
            }`}
          >
            {cliente ? (
              <div className="flex justify-between items-center">
                <div className="min-w-0 flex-1">
                  <div className={`font-semibold text-xs truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {cliente.nombre}
                  </div>
                  <div className={`text-[10px] ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {cliente.telefono} • ⭐ {cliente.puntos_totales}
                  </div>
                </div>
              </div>
            ) : (
              <div className={`text-center text-xs font-medium ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                + Agregar Cliente
              </div>
            )}
          </button>

      {/* Total */}
          <div className={`flex justify-between items-center py-1 ${darkMode ? 'border-b border-gray-700' : 'border-b border-gray-200'}`}>
            <span className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Total:</span>
            <span className="text-xl font-bold text-orange-600">{formatGuaranies(total)}</span>
          </div>

          {/* Tipo de pedido - compacto */}
          <div className="space-y-1">
            <div className={`text-[10px] font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Tipo:</div>
            <div className="grid grid-cols-3 gap-1.5">
              {ORDER_TYPES.map((option) => {
                const isActive = tipo === option.value
                const helperColor = isActive
                  ? 'text-white/90'
                  : darkMode
                    ? 'text-gray-400'
                    : 'text-gray-500'

                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isActive}
                    aria-label={option.label}
                    onClick={() => setTipo(option.value)}
                    className={`px-2 py-1.5 rounded-xl text-[11px] font-semibold transition-all flex flex-col items-center gap-0.5 border text-center focus-visible:outline-none focus-visible:ring-2 ${orderTypeFocusOffset} ${
                      isActive ? option.activeClass : orderTypeInactiveClasses
                    }`}
                    title={option.helper}
                  >
                    <span className="text-lg leading-none">{option.icon}</span>
                    <span className="leading-tight">{option.label}</span>
                    <span className={`text-[9px] font-medium leading-tight ${helperColor}`}>
                      {option.helper}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Botón confirmar - siempre visible */}
          <button
            onClick={onConfirmOrder}
            disabled={!tipo || isProcessing}
            className={`w-full py-2.5 rounded-lg font-bold text-sm transition-all disabled:cursor-not-allowed ${
              !tipo || isProcessing
                ? darkMode
                  ? 'bg-gray-700 text-gray-400'
                  : 'bg-gray-400 text-gray-600'
                : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-md'
            }`}
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-1">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Procesando...
              </span>
            ) : (
              '✓ Confirmar Pedido'
            )}
          </button>
        </div>
      )}
    </div>
  )
}

