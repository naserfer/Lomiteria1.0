const STORAGE_KEY = 'lomiteria:mesaPedidoCocinaToast'

export const MESA_PEDIDO_COCINA_TOAST_MESSAGE = 'Pedido enviado a cocina'

export type MesaPedidoCocinaToastPayload = {
  message: string
  /** Marca de tiempo (ms) a la cual el mensaje deja de mostrarse */
  expiresAt: number
}

export function setMesaPedidoCocinaToastSession(
  message: string,
  visibleDurationMs: number,
): void {
  if (typeof window === 'undefined') return
  const payload: MesaPedidoCocinaToastPayload = {
    message,
    expiresAt: Date.now() + visibleDurationMs,
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

/** Payload vigente o `null` si expiró o no hay entrada (limpia entrada expirada). */
export function getPendingMesaPedidoCocinaToastSession(): MesaPedidoCocinaToastPayload | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as MesaPedidoCocinaToastPayload
    if (typeof data.message !== 'string' || typeof data.expiresAt !== 'number') {
      sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    if (data.expiresAt <= Date.now()) {
      sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    return data
  } catch {
    sessionStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function clearMesaPedidoCocinaToastSession(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(STORAGE_KEY)
}
