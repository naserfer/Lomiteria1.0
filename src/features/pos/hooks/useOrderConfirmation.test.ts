import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useOrderConfirmation } from './useOrderConfirmation'

const mockUseTenant = vi.fn()
const mockUseCartStore = vi.fn()
const mockConfirmOrder = vi.fn()

vi.mock('@/contexts/TenantContext', () => ({
  useTenant: () => mockUseTenant(),
}))

vi.mock('@/store/cartStore', () => ({
  useCartStore: () => mockUseCartStore(),
}))

vi.mock('@/config', () => ({
  FEATURES: { POS_FACTURA_MODAL: true },
}))

vi.mock('../services/orderService', () => ({
  orderService: {
    confirmOrder: (...args: unknown[]) => mockConfirmOrder(...args),
  },
}))

describe('useOrderConfirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseTenant.mockReturnValue({
      usuario: { id: 'user-1', nombre: 'Caja 1' },
      tenant: {
        id: 'tenant-1',
        nombre: 'Lomiteria',
        gestion_mesas: true,
        puntos_retorno_pct: 5,
      },
    })

    mockUseCartStore.mockReturnValue({
      items: [{ id: 'item-1', cantidad: 1, precio: 10000, subtotal: 10000 }],
      cliente: null,
      tipo: 'para_llevar',
      clearCart: vi.fn(),
      getTotal: () => 10000,
    })

    mockConfirmOrder.mockResolvedValue({
      pedido: { id: 'pedido-1', numero_pedido: 45 },
      successDetails: [],
    })
  })

  it('emite factura en sin mesa aunque gestion_mesas=true', async () => {
    const { result } = renderHook(() => useOrderConfirmation(null))

    await act(async () => {
      await result.current.confirmOrderWithFacturaChoice(false, false)
    })

    expect(mockConfirmOrder).toHaveBeenCalledTimes(1)
    const payload = mockConfirmOrder.mock.calls[0][0]
    expect(payload.emitirFactura).toBe(true)
    expect(payload.mesaId).toBeNull()
    expect(payload.cliente).toBeNull()
    expect(payload.suppressPuntosEnSuccessDetails).toBe(true)
    expect(payload.suppressPuntosGanadosSideEffects).toBe(true)
  })

  it('no emite factura cuando el pedido tiene mesa', async () => {
    const { result } = renderHook(() => useOrderConfirmation('mesa-7'))

    await act(async () => {
      await result.current.confirmOrderWithFacturaChoice(true, false)
    })

    const payload = mockConfirmOrder.mock.calls[0][0]
    expect(payload.emitirFactura).toBe(false)
    expect(payload.mesaId).toBe('mesa-7')
    expect(payload.suppressPuntosEnSuccessDetails).toBe(false)
    expect(payload.suppressPuntosGanadosSideEffects).toBe(false)
  })

  it('permite forzar tipo local al confirmar sin factura', async () => {
    const { result } = renderHook(() => useOrderConfirmation(null))

    await act(async () => {
      await result.current.confirmOrderNoFactura({ forceTipo: 'local' })
    })

    const payload = mockConfirmOrder.mock.calls[0][0]
    expect(payload.tipo).toBe('local')
    expect(payload.emitirFactura).toBe(false)
  })
})
