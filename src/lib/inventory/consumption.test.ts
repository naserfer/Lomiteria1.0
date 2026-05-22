import { describe, expect, it } from 'vitest'
import { itemPedidoRowToCartItem } from './consumption'

describe('itemPedidoRowToCartItem', () => {
  it('mapea removidos y extras desde customizaciones persistidas', () => {
    const cart = itemPedidoRowToCartItem({
      id: 'item-1',
      producto_id: 'prod-1',
      producto_nombre: 'Lomito',
      cantidad: 2,
      precio_unitario: 25000,
      subtotal: 50000,
      items_pedido_customizacion: [
        {
          tipo: 'removido',
          ingredientes: { slug: 'cebolla', nombre: 'Cebolla' },
        },
        {
          tipo: 'extra',
          cantidad_original: 0,
          cantidad_ajustada: 1,
          precio_extra: 4000,
          ingredientes: { slug: 'bacon', nombre: 'Bacon' },
        },
      ],
    })

    expect(cart.customization?.removedIngredients).toEqual([
      { slug: 'cebolla', label: 'Cebolla' },
    ])
    expect(cart.customization?.extras).toHaveLength(1)
    expect(cart.customization?.extras[0].slug).toBe('bacon')
    expect(cart.customization?.extras[0].quantityPerItem).toBe(1)
  })

  it('producto manual sin producto_id no requiere customization', () => {
    const cart = itemPedidoRowToCartItem({
      id: 'item-2',
      producto_id: null,
      producto_nombre: 'Servicio',
      cantidad: 1,
      precio_unitario: 10000,
      subtotal: 10000,
    })
    expect(cart.producto_id).toBeNull()
    expect(cart.customization).toBeUndefined()
  })
})
