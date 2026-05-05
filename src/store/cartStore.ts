import { create } from 'zustand'
import type { IngredientRequirement } from '@/types/ingredients'
import type { Cliente } from '@/types/supabase'
import {
  calcularPuntos,
  calcularPuntosAutomaticos,
  normalizePuntosRetornoPct,
  VALOR_PUNTO_GS,
  type PuntosRetornoPct,
} from '@/features/pos/utils/pos.utils'

export interface ExtraIngredientSelection extends IngredientRequirement {
  unitPrice: number
}

export interface RemovedIngredientInfo {
  slug: string
  label: string
}

export interface CartItemCustomization {
  removedIngredients: RemovedIngredientInfo[]
  extras: ExtraIngredientSelection[]
  resolvedRecipe: IngredientRequirement[]
  notes?: string
}

// Item dentro de un combo (producto con su cantidad y customización)
export interface ComboProductItem {
  producto_id: string
  nombre: string
  descripcion?: string
  cantidad: number
  tiene_receta: boolean
  customization?: CartItemCustomization
}

export interface CartItem {
  id: string
  producto_id: string | null
  nombre: string
  descripcion?: string
  precio: number
  cantidad: number
  subtotal: number
  notas?: string
  extraCostPerUnit?: number
  tipo: 'producto' | 'combo' // Identifica si es producto individual o combo
  customization?: CartItemCustomization // Para productos individuales
  comboItems?: ComboProductItem[] // Para combos: lista de productos componentes
  /** Agrupación UI: por ejemplo salsas por vasitos */
  grupo?: 'salsa'
  /** Puntos bonus por unidad definidos por el admin en este producto */
  puntos_extra?: number
  /** Canje: línea que aplica descuento al total (subtotal=0) y se paga con puntos. */
  modo?: 'venta' | 'canje'
  /** Puntos requeridos por unidad para canjear este producto */
  puntos_canje?: number
  /** Item inventado en POS (no catalogado) */
  is_manual?: boolean
}

interface CartState {
  items: CartItem[]
  cliente: Cliente | null
  tipo: 'delivery' | 'local' | 'para_llevar' | null

  // Acciones
  addItem: (producto: { id: string; nombre: string; descripcion?: string; precio: number; tiene_receta?: boolean; puntos_extra?: number }) => void
  upsertSauceItem: (producto: { id: string; nombre: string; descripcion?: string; precio: number }, cantidad: number) => void
  addComboItem: (combo: { id: string; nombre: string; descripcion?: string; precio: number; comboItems: ComboProductItem[] }) => void
  addCanjeItem: (item: { id: string; nombre: string; descripcion?: string; puntos_canje: number; cantidad?: number }) => void
  addManualItem: (nombre: string, precio?: number) => void
  removeItem: (itemId: string) => void
  updateQuantity: (itemId: string, cantidad: number) => void
  updateItemCustomization: (itemId: string, customization: CartItemCustomization | null, extraCostPerUnit: number) => void
  updateComboProductCustomization: (cartItemId: string, productoId: string, customization: CartItemCustomization | null) => void
  clearCart: () => void
  setCliente: (cliente: Cliente | null) => void
  setTipo: (tipo: 'delivery' | 'local' | 'para_llevar') => void

  // Computed
  getTotal: () => number
  getItemCount: () => number
  /** Puntos del carrito: automáticos (% del total según tenant) + bonus por producto */
  getTotalPuntos: (retornoPct?: PuntosRetornoPct) => {
    puntosAuto: number
    puntosExtra: number
    total: number
    valorGs: number
  }
}

const calculateSubtotal = (precioBase: number, extraCostPerUnit: number | undefined, cantidad: number) => {
  const extras = extraCostPerUnit ?? 0
  return (precioBase + extras) * cantidad
}

const isBaseSaleItem = (item: CartItem) => {
  const hasCustomization =
    Boolean(item.customization) ||
    (item.extraCostPerUnit ?? 0) > 0

  return item.tipo === 'producto' && item.modo !== 'canje' && !hasCustomization
}

/** Componente de combo con modificación de receta (extras, sin ingredientes, notas). */
const comboProductHasRecipeCustomization = (cp: ComboProductItem): boolean => {
  const c = cp.customization
  if (!c) return false
  if ((c.removedIngredients?.length ?? 0) > 0) return true
  if ((c.extras?.length ?? 0) > 0) return true
  if (c.notes?.trim()) return true
  return false
}

/**
 * Combo sin personalización de receta en ningún componente (mismo criterio que producto “base” para sumar cantidad).
 */
const isBaseComboItem = (item: CartItem): boolean => {
  if (item.tipo !== 'combo' || item.modo !== 'venta') return false
  if ((item.extraCostPerUnit ?? 0) > 0) return false
  if (!item.comboItems?.length) return true
  return !item.comboItems.some(comboProductHasRecipeCustomization)
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  cliente: null,
  tipo: null,

  addItem: (producto) => {
    const items = get().items
    const existingItem = items.find(
      (item) => item.producto_id === producto.id && isBaseSaleItem(item)
    )

    if (existingItem) {
      set({
        items: items.map(item =>
          item.id === existingItem.id
            ? {
                ...item,
                cantidad: item.cantidad + 1,
                subtotal: calculateSubtotal(item.precio, item.extraCostPerUnit, item.cantidad + 1)
              }
            : item
        )
      })
    } else {
      set({
        items: [
          ...items,
          {
            id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `temp-${Date.now()}-${Math.random()}`,
            producto_id: producto.id,
            nombre: producto.nombre,
            descripcion: producto.descripcion,
            precio: producto.precio,
            cantidad: 1,
            subtotal: producto.precio,
            extraCostPerUnit: 0,
            tipo: 'producto' as const,
            puntos_extra: producto.puntos_extra ?? 0,
            modo: 'venta'
          }
        ]
      })
    }
  },

  upsertSauceItem: (producto, cantidad) => {
    const qty = Math.max(0, Math.floor(cantidad))
    const items = get().items
    const existing = items.find(
      (i) => i.grupo === 'salsa' && i.tipo === 'producto' && i.producto_id === producto.id && i.modo !== 'canje'
    )

    if (qty === 0) {
      if (!existing) return
      const nextItems = items.filter((i) => i.id !== existing.id)
      if (nextItems.length === 0) {
        set({ items: [], cliente: null, tipo: null })
        return
      }
      set({ items: nextItems })
      return
    }

    const next: CartItem = {
      id:
        existing?.id ??
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `temp-${Date.now()}-${Math.random()}`),
      producto_id: producto.id,
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      precio: producto.precio,
      cantidad: qty,
      subtotal: producto.precio * qty,
      extraCostPerUnit: 0,
      tipo: 'producto',
      grupo: 'salsa',
      puntos_extra: 0,
      modo: 'venta',
    }

    if (existing) {
      set({
        items: items.map((i) => (i.id === existing.id ? next : i)),
      })
      return
    }

    set({ items: [...items, next] })
  },

  addComboItem: (combo) => {
    const items = get().items
    const existingItem = items.find(
      (item) => item.producto_id === combo.id && isBaseComboItem(item)
    )

    if (existingItem) {
      set({
        items: items.map((item) =>
          item.id === existingItem.id
            ? {
                ...item,
                cantidad: item.cantidad + 1,
                subtotal: calculateSubtotal(item.precio, item.extraCostPerUnit, item.cantidad + 1),
              }
            : item
        ),
      })
      return
    }

    set({
      items: [
        ...items,
        {
          id:
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `temp-${Date.now()}-${Math.random()}`,
          producto_id: combo.id,
          nombre: combo.nombre,
          descripcion: combo.descripcion,
          precio: combo.precio,
          cantidad: 1,
          subtotal: combo.precio,
          extraCostPerUnit: 0,
          tipo: 'combo' as const,
          comboItems: combo.comboItems,
          modo: 'venta',
        },
      ],
    })
  },

  addCanjeItem: ({ id, nombre, descripcion, puntos_canje, cantidad = 1 }) => {
    const items = get().items

    const existingItem = items.find(
      (item) => item.producto_id === id && item.tipo === 'producto' && item.modo === 'canje'
    )

    if (existingItem) {
      set({
        items: items.map((item) =>
          item.id === existingItem.id
            ? {
                ...item,
                cantidad: item.cantidad + cantidad,
                // Canje siempre aporta descuento: total del ítem = 0
                subtotal: 0
              }
            : item
        )
      })

      return
    }

    set({
      items: [
        ...items,
        {
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `temp-${Date.now()}-${Math.random()}`,
          producto_id: id,
          nombre,
          descripcion,
          precio: 0,
          cantidad,
          subtotal: 0,
          extraCostPerUnit: 0,
          tipo: 'producto',
          puntos_extra: 0,
          modo: 'canje',
          puntos_canje
        }
      ]
    })
  },

  addManualItem: (nombre, precio = 0) => {
    const cleanName = nombre.trim()
    if (!cleanName) return
    const safePrice = Math.max(0, Math.round(Number(precio) || 0))

    set({
      items: [
        ...get().items,
        {
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `temp-${Date.now()}-${Math.random()}`,
          producto_id: null,
          nombre: cleanName,
          precio: safePrice,
          cantidad: 1,
          subtotal: safePrice,
          extraCostPerUnit: 0,
          tipo: 'producto',
          puntos_extra: 0,
          modo: 'venta',
          is_manual: true,
        }
      ]
    })
  },

  removeItem: (itemId) => {
    const nextItems = get().items.filter(item => item.id !== itemId)

    // Si el carrito queda vacío, limpiamos también el resto de estado relacionado
    // (cliente y tipo de pedido) para evitar "estado fantasma".
    if (nextItems.length === 0) {
      set({
        items: [],
        cliente: null,
        tipo: null,
      })
      return
    }

    set({ items: nextItems })
  },

  updateQuantity: (itemId, cantidad) => {
    if (cantidad <= 0) {
      const nextItems = get().items.filter(item => item.id !== itemId)

      if (nextItems.length === 0) {
        set({
          items: [],
          cliente: null,
          tipo: null,
        })
        return
      }

      set({ items: nextItems })
      return
    }

    set({
      items: get().items.map(item =>
        item.id === itemId
          ? {
              ...item,
              cantidad,
              subtotal: calculateSubtotal(item.precio, item.extraCostPerUnit, cantidad)
            }
          : item
      )
    })
  },

  updateItemCustomization: (itemId, customization, extraCostPerUnit) => {
    set({
      items: get().items.map(item =>
        item.id === itemId
          ? {
              ...item,
              customization: customization ?? undefined,
              extraCostPerUnit,
              subtotal: calculateSubtotal(item.precio, extraCostPerUnit, item.cantidad)
            }
          : item
      )
    })
  },

  updateComboProductCustomization: (cartItemId, productoId, customization) => {
    set({
      items: get().items.map(item => {
        if (item.id === cartItemId && item.tipo === 'combo' && item.comboItems) {
          // Actualizar customización del producto específico dentro del combo
          const updatedComboItems = item.comboItems.map(comboProduct =>
            comboProduct.producto_id === productoId
              ? {
                  ...comboProduct,
                  customization: customization ?? undefined
                }
              : comboProduct
          )
          
          // Calcular costo extra total del combo sumando todos los productos
          const totalExtraCost = updatedComboItems.reduce((sum, comboProduct) => {
            if (comboProduct.customization?.extras) {
              const productExtraCost = comboProduct.customization.extras.reduce(
                (extraSum, extra) => extraSum + (extra.unitPrice * extra.quantityPerItem),
                0
              )
              return sum + (productExtraCost * comboProduct.cantidad)
            }
            return sum
          }, 0)
          
          return {
            ...item,
            comboItems: updatedComboItems,
            extraCostPerUnit: totalExtraCost,
            subtotal: calculateSubtotal(item.precio, totalExtraCost, item.cantidad)
          }
        }
        return item
      })
    })
  },

  clearCart: () => {
    set({
      items: [],
      cliente: null,
      tipo: null,
    })
  },

  setCliente: (cliente) => {
    set({ cliente })
  },

  setTipo: (tipo) => {
    set({ tipo })
  },

  getTotal: () => {
    return get().items.reduce((total, item) => total + item.subtotal, 0)
  },

  getItemCount: () => {
    return get().items.reduce((count, item) => count + item.cantidad, 0)
  },

  getTotalPuntos: (retornoPct) => {
    const total = get().getTotal()
    const pct = normalizePuntosRetornoPct(retornoPct)
    const puntosAuto = calcularPuntosAutomaticos(total, pct)
    const puntosExtra = get().items.reduce(
      (sum, item) => (item.is_manual ? sum : sum + ((item.puntos_extra ?? 0) * item.cantidad)),
      0
    )
    const totalPuntos = puntosAuto + puntosExtra
    return { puntosAuto, puntosExtra, total: totalPuntos, valorGs: totalPuntos * VALOR_PUNTO_GS }
  }
}))


