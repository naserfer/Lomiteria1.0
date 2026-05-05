import { useState } from 'react'
import { useCartStore } from '@/store/cartStore'
import { useTenant } from '@/contexts/TenantContext'
import { normalizePuntosRetornoPct } from '@/features/pos/utils/pos.utils'
import { FEATURES } from '@/config'
import { orderService } from '../services/orderService'
import type { FeedbackState, FeedbackDetail } from '../types/pos.types'
import { buildUnexpectedErrorState } from '../utils/error.utils'

export function useOrderConfirmation(mesaId?: string | null) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [facturaPrefModalOpen, setFacturaPrefModalOpen] = useState(false)

  const { usuario, tenant } = useTenant()
  const { items, cliente, tipo, clearCart, getTotal } = useCartStore()

  const showInlineError = (title: string, message: string, details?: FeedbackDetail[]) => {
    return {
      type: 'error' as const,
      title,
      message,
      details,
    }
  }

  /** Validaciones previas; si pasa, abre el modal “¿Desea factura?”. */
  const prepareConfirmOrder = (): FeedbackState | null => {
    if (!tipo) {
      return showInlineError(
        'Seleccioná el tipo de pedido',
        'Elegí el tipo de pedido antes de cobrar.'
      )
    }

    if (mesaId && tipo === 'delivery') {
      return showInlineError(
        'Tipo incompatible con mesa',
        'Los pedidos de mesa no pueden ser delivery. Elegí "Comer aquí" o "Para llevar".'
      )
    }

    if (items.length === 0) {
      return showInlineError(
        'Tu carrito está vacío',
        'Agregá al menos un producto antes de confirmar.'
      )
    }
    if (!usuario || !tenant) {
      return showInlineError(
        'No encontramos el usuario',
        'Volvé a iniciar sesión para poder registrar ventas.'
      )
    }

    // Pedidos con mesa: cocina inmediata y cuenta diferida; no abrir modal de factura.
    if (mesaId) {
      return null
    }

    if (!FEATURES.POS_FACTURA_MODAL) {
      // Feature flag apagado: confirmación directa sin factura (sin modal).
      // El flujo de UI llamará a `confirmOrderNoFactura`.
      return null
    }

    setFacturaPrefModalOpen(true)
    return null
  }

  const confirmOrderNoFactura = async (): Promise<FeedbackState | null> => {
    if (!usuario || !tenant || !tipo) {
      return showInlineError(
        'No encontramos el usuario',
        'Volvé a iniciar sesión para poder registrar ventas.'
      )
    }
    setIsProcessing(true)
    try {
      const total = getTotal()
      const puntosRetornoPct = normalizePuntosRetornoPct(tenant.puntos_retorno_pct)

      const { pedido, successDetails } = await orderService.confirmOrder({
        tenantId: tenant.id,
        usuarioId: usuario.id,
        tenantNombre: tenant.nombre,
        usuarioNombre: usuario.nombre,
        cliente,
        tipo,
        items,
        total,
        emitirFactura: false,
        facturaALNombreDelCliente: false,
        facturaMostrarNombreYCI: false,
        puntosRetornoPct,
        mesaId: mesaId ?? null,
      })

      clearCart()

      return {
        type: 'success',
        title: `Pedido #${pedido.numero_pedido} confirmado`,
        message: 'Venta registrada y stock actualizado.',
        details: successDetails,
      }
    } catch (error) {
      const err =
        error instanceof Error
          ? error
          : new Error(String((error as { message?: string })?.message ?? 'Error desconocido'))
      console.error('Error confirmando pedido:', err.message, error)
      return buildUnexpectedErrorState('No pudimos confirmar el pedido', err)
    } finally {
      setIsProcessing(false)
    }
  }

  const cancelFacturaModal = () => {
    if (!isProcessing) setFacturaPrefModalOpen(false)
  }

  const confirmOrderWithFacturaChoice = async (
    facturaALNombreDelCliente: boolean,
    comprobanteNombreYCI: boolean
  ): Promise<FeedbackState | null> => {
    if (!usuario || !tenant || !tipo) {
      setFacturaPrefModalOpen(false)
      return showInlineError(
        'No encontramos el usuario',
        'Volvé a iniciar sesión para poder registrar ventas.'
      )
    }
    setIsProcessing(true)

    try {
      const total = getTotal()

      const puntosRetornoPct = normalizePuntosRetornoPct(tenant.puntos_retorno_pct)

      const { pedido, successDetails } = await orderService.confirmOrder({
        tenantId: tenant.id,
        usuarioId: usuario.id,
        tenantNombre: tenant.nombre,
        usuarioNombre: usuario.nombre,
        cliente,
        tipo,
        items,
        total,
        emitirFactura: !mesaId,
        facturaALNombreDelCliente,
        facturaMostrarNombreYCI: !facturaALNombreDelCliente && comprobanteNombreYCI,
        puntosRetornoPct,
        mesaId: mesaId ?? null,
      })

      setFacturaPrefModalOpen(false)
      clearCart()

      return {
        type: 'success',
        title: `Pedido #${pedido.numero_pedido} confirmado`,
        message: 'Venta registrada y stock actualizado.',
        details: successDetails,
      }
    } catch (error) {
      const err =
        error instanceof Error
          ? error
          : new Error(String((error as { message?: string })?.message ?? 'Error desconocido'))
      console.error('Error confirmando pedido:', err.message, error)
      return buildUnexpectedErrorState('No pudimos confirmar el pedido', err)
    } finally {
      setIsProcessing(false)
    }
  }

  return {
    prepareConfirmOrder,
    confirmOrderWithFacturaChoice,
    confirmOrderNoFactura,
    cancelFacturaModal,
    facturaPrefModalOpen,
    isProcessing,
  }
}
