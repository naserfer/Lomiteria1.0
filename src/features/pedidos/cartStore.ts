import { create } from 'zustand'
import type { IngredientRequirement } from '@/features/ingredientes/ingredients.types'
import type { Cliente } from '@/shared/types/supabase'

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

export interface CartItem {
  id: string
  producto_id: string
  nombre: string
  descripcion?: string
  precio: number
  cantidad: number
  subtotal: number
  notas?: string
  extraCostPerUnit?: number
  customization?: CartItemCustomization
}

interface CartState {
  items: CartItem[]
  cliente: Cliente | null
  tipo: 'delivery' | 'local' | 'para_llevar' | null
  
  // Acciones
  addItem: (producto: { id: string; nombre: string; descripcion?: string; precio: number }) => void
  removeItem: (itemId: string) => void
  updateQuantity: (itemId: string, cantidad: number) => void
  updateItemCustomization: (itemId: string, customization: CartItemCustomization | null, extraCostPerUnit: number) => void
  clearCart: () => void
  setCliente: (cliente: Cliente | null) => void
  setTipo: (tipo: 'delivery' | 'local' | 'para_llevar') => void
  
  // Computed
  getTotal: () => number
  getItemCount: () => number
}

const calculateSubtotal = (precioBase: number, extraCostPerUnit: number | undefined, cantidad: number) => {
  const extras = extraCostPerUnit ?? 0
  return (precioBase + extras) * cantidad
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  cliente: null,
  tipo: null,

  addItem: (producto) => {
    const items = get().items
    const existingItem = items.find(item => item.producto_id === producto.id)

    if (existingItem) {
      // Si ya existe, incrementar cantidad
      set({
        items: items.map(item =>
          item.producto_id === producto.id
            ? {
                ...item,
                cantidad: item.cantidad + 1,
                subtotal: calculateSubtotal(item.precio, item.extraCostPerUnit, item.cantidad + 1)
              }
            : item
        )
      })
    } else {
      // Si no existe, agregar nuevo
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
            extraCostPerUnit: 0
          }
        ]
      })
    }
  },

  removeItem: (itemId) => {
    set({
      items: get().items.filter(item => item.id !== itemId)
    })
  },

  updateQuantity: (itemId, cantidad) => {
    if (cantidad <= 0) {
      get().removeItem(itemId)
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

  clearCart: () => {
    set({
      items: [],
      cliente: null,
      tipo: null
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
  }
}))


