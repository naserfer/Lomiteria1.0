'use client'

import { useCartStore, type CartItem } from '@/store/cartStore'
import { Trash2, Plus, Minus, ShoppingBag, Settings2, Star, Zap, Gift, Droplets } from 'lucide-react'
import { formatGuaranies } from '@/lib/utils/format'
import { useMemo, useState } from 'react'
import { useTenant } from '@/contexts/TenantContext'
import { normalizePuntosRetornoPct } from '@/features/pos/utils/pos.utils'
import { SaucesDrawer } from './SaucesDrawer'

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
  isMesaOrder?: boolean
  allowManualItem?: boolean
}

const normalizeExtraToken = (value: string) =>
  value
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\bdesde\s+notas?\b/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const extractExtraFromText = (value?: string) => {
  const raw = value?.trim()
  if (!raw) return null
  const match = raw.match(/^\s*extra\s+(.+)$/i)
  if (!match?.[1]) return null
  const cleaned = match[1].replace(/\bdesde\s+notas?\b/gi, '').replace(/\s+/g, ' ').trim()
  return cleaned || null
}

export default function Cart({
  onOpenClientModal,
  onConfirmOrder,
  isProcessing,
  darkMode,
  onEditItem,
  isMesaOrder = false,
  allowManualItem = false,
}: Props) {
  const { tenant, hasDelivery } = useTenant()
  const { items, cliente, tipo, removeItem, updateQuantity, getTotal, getTotalPuntos, setTipo, upsertSauceItem, addManualItem } = useCartStore()
  const [saucesOpen, setSaucesOpen] = useState(false)
  const [manualItemName, setManualItemName] = useState('')
  const orderTypeInactiveClasses = darkMode
    ? 'bg-gray-700/60 text-gray-200 border-gray-600 hover:bg-gray-600'
    : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
  const orderTypeFocusOffset = darkMode
    ? 'focus-visible:ring-offset-gray-800'
    : 'focus-visible:ring-offset-white'
  
  const total = getTotal()
  const visibleItems = useMemo(() => items.filter((i) => i.grupo !== 'salsa'), [items])
  const itemCount = visibleItems.reduce((sum, item) => sum + item.cantidad, 0)
  const retornoPct = normalizePuntosRetornoPct(tenant?.puntos_retorno_pct)
  const puntos = getTotalPuntos(retornoPct)
  const sauceItems = useMemo(() => items.filter((i) => i.grupo === 'salsa'), [items])
  const availableOrderTypes = useMemo(
    () => ORDER_TYPES.filter(o => o.value !== 'delivery' || (hasDelivery && !isMesaOrder)),
    [hasDelivery, isMesaOrder]
  )

  const saucesInitialQty = useMemo(() => {
    const map: Record<string, number> = {}
    sauceItems.forEach((i) => {
      if (i.producto_id == null) return
      map[i.producto_id] = i.cantidad
    })
    return map
  }, [sauceItems])

  const handleAddManualItem = () => {
    const cleanName = manualItemName.trim()
    if (!cleanName) return
    addManualItem(cleanName.slice(0, 80))
    setManualItemName('')
  }

  return (
    <div
      className={`rounded-2xl shadow-2xl flex flex-col min-h-0 overflow-hidden ${darkMode ? 'bg-gray-800' : 'bg-white'}`}
    >
      {/* Header fijo */}
      <div className="flex items-center gap-3 p-3 border-b flex-shrink-0">
        <ShoppingBag className="text-orange-600" size={20} />
        <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Pedido {itemCount > 0 && `(${itemCount})`}
        </h2>
      </div>

      {/* Lista de items - scrollable */}
      <div className="overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-orange-500 scrollbar-track-transparent hover:scrollbar-thumb-orange-600" style={{ maxHeight: '350px' }}>
        {visibleItems.length === 0 ? (
          <div className={`text-center py-8 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            <div className="text-4xl mb-2">🛒</div>
            <p className="text-sm">Selecciona productos</p>
          </div>
        ) : (
          visibleItems.map((item) => (
            <div
              key={item.id}
              className={`rounded-lg p-3 border ${
                darkMode 
                  ? 'bg-gray-700/50 border-gray-600'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="mb-2">
                <div className="mb-2 flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => onEditItem?.(item.id)}
                    disabled={!onEditItem || item.is_manual}
                    className={`flex-1 min-w-0 rounded-xl border px-2.5 py-2 text-left transition ${
                      onEditItem && !item.is_manual
                        ? darkMode
                          ? 'border-gray-600 bg-gray-700/40 hover:border-orange-400/60 hover:bg-gray-700'
                          : 'border-gray-200 bg-gray-100/80 hover:border-orange-300 hover:bg-orange-50/50'
                        : darkMode
                          ? 'border-gray-700 bg-gray-700/30 text-gray-500 cursor-not-allowed'
                          : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                    title="Editar ingredientes"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`truncate text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        {item.nombre}
                      </span>
                      {item.tipo === 'combo' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300">
                          COMBO
                        </span>
                      )}
                      {item.is_manual && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                          MANUAL
                        </span>
                      )}
                    </div>
                    <div className={`mt-0.5 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {item.is_manual ? 'Precio se carga al cerrar cuenta' : 'Tocar para editar ingredientes'}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditItem?.(item.id)}
                    disabled={!onEditItem || item.is_manual}
                    className={`min-h-[44px] shrink-0 inline-flex items-center gap-1.5 px-3 rounded-xl text-xs font-semibold transition ${
                      onEditItem && !item.is_manual
                        ? darkMode
                          ? 'bg-gray-800 text-orange-200 hover:bg-gray-700'
                          : 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'
                        : darkMode
                          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                    title="Editar ingredientes"
                  >
                    <Settings2 size={14} />
                    Editar
                  </button>
                </div>
                {item.tipo === 'combo' && item.comboItems ? (
                  <div className={`text-[11px] space-y-1 mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {item.comboItems.map((ci) => (
                      <div key={ci.producto_id}>
                        <div className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                          - {ci.nombre}{ci.cantidad > 1 ? ` x${ci.cantidad}` : ''}
                        </div>
                        {ci.customization?.removedIngredients.map((r) => (
                          <div key={r.slug} className="ml-3 text-red-400 text-[10px]">- {r.label}</div>
                        ))}
                        {ci.customization?.extras.map((e) => (
                          <div key={e.slug} className="ml-3 text-green-500 text-[10px]">+ {e.label}{e.quantityPerItem > 1 ? ` (x${e.quantityPerItem})` : ''}</div>
                        ))}
                        {ci.customization?.notes?.trim() && (
                          <div
                            className={`ml-3 mt-0.5 rounded-lg border px-2 py-1 text-xs font-medium ${
                              darkMode
                                ? 'border-amber-500/40 bg-amber-950/40 text-amber-100'
                                : 'border-amber-200 bg-amber-50 text-amber-900'
                            }`}
                          >
                            {ci.customization.notes.trim()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {item.descripcion && (
                      <div className={`text-xs leading-relaxed mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {item.descripcion}
                      </div>
                    )}
                    {item.customization && (
                      <div className={`text-[11px] space-y-1 mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        {(() => {
                          const extrasFromButtons = item.customization.extras.map((extra) =>
                            `${extra.label} (${extra.quantityPerItem}${extra.unit})`
                          )
                          const noteAsExtra = extractExtraFromText(item.customization.notes)
                          const allExtraTokens = new Set(
                            extrasFromButtons.map((x) => normalizeExtraToken(x))
                          )
                          const noteAsExtraLabel =
                            noteAsExtra && !allExtraTokens.has(normalizeExtraToken(noteAsExtra))
                              ? `${noteAsExtra} (1unidad)`
                              : null
                          const visibleExtras = noteAsExtraLabel
                            ? [...extrasFromButtons, noteAsExtraLabel]
                            : extrasFromButtons
                          const hasOnlyGenericNote = Boolean(item.customization.notes?.trim()) && !noteAsExtra

                          return (
                            <>
                              {visibleExtras.length > 0 && (
                                <p>
                                  <span className="font-semibold text-green-500 mr-1">+ Extras:</span>
                                  {visibleExtras.join(', ')}
                                </p>
                              )}
                              {item.customization.removedIngredients.length > 0 && (
                                <p>
                                  <span className="font-semibold text-red-400 mr-1">- Sin:</span>
                                  {item.customization.removedIngredients.map((ing) => ing.label).join(', ')}
                                </p>
                              )}
                              {hasOnlyGenericNote && (
                                <p
                                  className={`mt-1 rounded-lg border px-2 py-1.5 text-sm font-medium leading-snug ${
                                    darkMode
                                      ? 'border-amber-500/40 bg-amber-950/35 text-amber-100'
                                      : 'border-amber-200 bg-amber-50 text-amber-950'
                                  }`}
                                >
                                  {item.customization.notes!.trim()}
                                </p>
                              )}
                            </>
                          )
                        })()}
                      </div>
                    )}
                    {!item.customization && item.notas?.trim() && (
                      (() => {
                        const noteAsExtra = extractExtraFromText(item.notas)
                        if (noteAsExtra) {
                          return (
                            <div className={`mb-2 mt-1 text-[11px] ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                              <span className="font-semibold text-green-500 mr-1">+ Extras:</span>
                              {noteAsExtra} (1unidad)
                            </div>
                          )
                        }
                        return (
                          <p
                            className={`mb-2 mt-1 rounded-lg border px-2 py-1.5 text-sm font-medium leading-snug ${
                              darkMode
                                ? 'border-amber-500/40 bg-amber-950/35 text-amber-100'
                                : 'border-amber-200 bg-amber-50 text-amber-950'
                            }`}
                          >
                            {item.notas.trim()}
                          </p>
                        )
                      })()
                    )}
                  </>
                )}
                {(item.cantidad > 1 || (item.extraCostPerUnit ?? 0) > 0) && (
                  <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Unitario: {formatGuaranies(item.precio + (item.extraCostPerUnit ?? 0))} × {item.cantidad}
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-between">
                <div className="text-base font-bold text-orange-600">
                  {formatGuaranies(item.subtotal)}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => updateQuantity(item.id, item.cantidad - 1)}
                    disabled={item.cantidad <= 1}
                    className={`min-h-[40px] min-w-[40px] rounded-lg transition-colors inline-flex items-center justify-center ${
                      item.cantidad <= 1
                        ? darkMode
                          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : darkMode
                          ? 'bg-gray-600 hover:bg-gray-500'
                          : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                  >
                    <Minus size={15} />
                  </button>
                  <span className="min-w-[2rem] text-center font-bold text-base">{item.cantidad}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.cantidad + 1)}
                    className="min-h-[40px] min-w-[40px] rounded-lg bg-orange-100 text-orange-600 hover:bg-orange-200 transition-colors inline-flex items-center justify-center"
                  >
                    <Plus size={15} />
                  </button>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="min-h-[40px] min-w-[40px] rounded-lg text-red-600 hover:bg-red-50 transition-colors inline-flex items-center justify-center ml-0.5"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {allowManualItem && (
        <div className={`flex-shrink-0 p-3 border-t ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <div className={`w-full p-2 rounded-lg border ${darkMode ? 'border-amber-500/30 bg-amber-500/5' : 'border-amber-200 bg-amber-50/60'}`}>
            <p className={`text-[11px] font-semibold mb-2 ${darkMode ? 'text-amber-200' : 'text-amber-700'}`}>
              Item rápido (fuera de carta)
            </p>
            <div className="flex items-center gap-2">
              <input
                value={manualItemName}
                onChange={(e) => setManualItemName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddManualItem()
                  }
                }}
                placeholder="Ej: Huevo frito"
                className={`flex-1 rounded-lg border px-2.5 py-2 text-xs ${
                  darkMode
                    ? 'border-gray-600 bg-gray-700 text-gray-100 placeholder:text-gray-400'
                    : 'border-gray-200 bg-white text-gray-900 placeholder:text-gray-400'
                }`}
              />
              <button
                type="button"
                onClick={handleAddManualItem}
                disabled={!manualItemName.trim()}
                className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sección fija inferior - siempre visible */}
      {items.length > 0 && (
        <div className={`flex-shrink-0 p-3 border-t space-y-2 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          {/* Salsas (vasitos) - justo arriba de Agregar Cliente */}
          <div
            className={`w-full p-2 rounded-lg border transition-all text-left ${
              darkMode
                ? 'bg-gray-700/20 border-orange-500/30'
                : 'bg-orange-50/40 border-orange-200'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Droplets className={darkMode ? 'text-orange-300' : 'text-orange-600'} size={16} />
                <div className="min-w-0">
                  <div className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    Salsas {sauceItems.length > 0 ? `(${sauceItems.reduce((s, i) => s + i.cantidad, 0)})` : ''}
                  </div>
                  <div className={`text-[10px] truncate ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {sauceItems.length === 0
                      ? 'Agregar vasitos (gratis o con costo)'
                      : sauceItems.map((s) => `${s.nombre} x${s.cantidad}`).join(' · ')}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSaucesOpen(true)}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold transition ${
                  darkMode
                    ? 'bg-gray-800 text-orange-200 hover:bg-gray-700'
                    : 'bg-white text-orange-700 border border-orange-200 hover:bg-orange-50'
                }`}
              >
                {sauceItems.length > 0 ? 'Editar' : 'Agregar'}
              </button>
            </div>
          </div>

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

          {/* Preview de puntos - siempre visible */}
          <div className={`rounded-xl px-3 py-2 ${darkMode ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-yellow-50 border border-yellow-200'}`}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Star size={13} className="text-yellow-500 fill-yellow-500 flex-shrink-0" />
              <span className={`text-[11px] font-bold ${darkMode ? 'text-yellow-300' : 'text-yellow-700'}`}>
                Puntos este pedido
              </span>
              <span className={`ml-auto text-[11px] font-bold ${darkMode ? 'text-yellow-200' : 'text-yellow-800'}`}>
                {puntos.total} pts
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 flex-1">
                <Zap size={10} className={darkMode ? 'text-blue-400' : 'text-blue-500'} />
                <span className={`text-[10px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Auto: <span className={`font-semibold ${darkMode ? 'text-blue-300' : 'text-blue-600'}`}>{puntos.puntosAuto}</span>
                </span>
              </div>
              {puntos.puntosExtra > 0 && (
                <div className="flex items-center gap-1 flex-1">
                  <Gift size={10} className={darkMode ? 'text-purple-400' : 'text-purple-500'} />
                  <span className={`text-[10px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Bonus: <span className={`font-semibold ${darkMode ? 'text-purple-300' : 'text-purple-600'}`}>+{puntos.puntosExtra}</span>
                  </span>
                </div>
              )}
              <span className={`text-[10px] font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                ≈ {formatGuaranies(puntos.valorGs)}
              </span>
            </div>
          </div>

          {/* Tipo de pedido - compacto */}
          <div className="space-y-1">
            <div className={`text-[10px] font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Tipo:</div>
            <div className={`grid gap-1.5 ${availableOrderTypes.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {availableOrderTypes.map((option) => {
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

      {/* Drawer de salsas */}
      {tenant?.id && (
        <SaucesDrawer
          open={saucesOpen}
          onClose={() => setSaucesOpen(false)}
          tenantId={tenant.id}
          darkMode={darkMode}
          initialQuantities={saucesInitialQty}
          onConfirm={(nextQty, saucesById) => {
            // Aplicar: actualizar las que el user tocó; y remover las que estaban antes pero ahora quedaron 0.
            const allIds = new Set<string>([
              ...Object.keys(saucesInitialQty),
              ...Object.keys(nextQty),
            ])
            for (const id of allIds) {
              const qty = nextQty[id] ?? 0
              const sauce = saucesById[id]
              // Si el catálogo no trajo este id (ej: salsa borrada), igual intentamos remover del carrito.
              if (!sauce) {
                upsertSauceItem({ id, nombre: 'Salsa', precio: 0 }, 0)
              } else {
                upsertSauceItem({ id: sauce.id, nombre: sauce.nombre, descripcion: sauce.descripcion ?? undefined, precio: sauce.precio }, qty)
              }
            }
          }}
        />
      )}
    </div>
  )
}
