import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import Cart from './Cart'

const mockUseTenant = vi.fn()
const mockUseCartStore = vi.fn()

vi.mock('@/contexts/TenantContext', () => ({
  useTenant: () => mockUseTenant(),
}))

vi.mock('@/store/cartStore', () => ({
  useCartStore: () => mockUseCartStore(),
}))

vi.mock('./SaucesDrawer', () => ({
  SaucesDrawer: () => null,
}))

describe('Cart - flujo sin mesa con mesas habilitadas', () => {
  const setTipo = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    mockUseTenant.mockReturnValue({
      tenant: { id: 'tenant-1', puntos_retorno_pct: 5 },
      hasDelivery: true,
    })

    mockUseCartStore.mockReturnValue({
      items: [
        {
          id: 'item-1',
          nombre: 'Lomito',
          cantidad: 1,
          precio: 10000,
          subtotal: 10000,
          grupo: 'principal',
        },
      ],
      cliente: null,
      tipo: 'local',
      removeItem: vi.fn(),
      updateQuantity: vi.fn(),
      getTotal: () => 10000,
      getTotalPuntos: () => ({
        total: 100,
        puntosAuto: 80,
        puntosExtra: 20,
        valorGs: 1000,
      }),
      setTipo,
      upsertSauceItem: vi.fn(),
      addManualItem: vi.fn(),
    })
  })

  it('oculta "Comer aquí" y fuerza tipo para_llevar cuando hideComerAquiOption=true', () => {
    render(
      <Cart
        onOpenClientModal={() => undefined}
        onConfirmOrder={() => undefined}
        hideComerAquiOption
      />,
    )

    expect(screen.queryByText('Comer aquí')).not.toBeInTheDocument()
    expect(screen.getByText('Para llevar')).toBeInTheDocument()
    expect(setTipo).toHaveBeenCalledWith('para_llevar')
  })

  it('oculta el preview "Puntos este pedido" en modo hideComerAquiOption', () => {
    render(
      <Cart
        onOpenClientModal={() => undefined}
        onConfirmOrder={() => undefined}
        hideComerAquiOption
      />,
    )

    expect(screen.queryByText('Puntos este pedido')).not.toBeInTheDocument()
  })
})
