'use client'

import { useEffect, useState } from 'react'
import {
  clearMesaPedidoCocinaToastSession,
  getPendingMesaPedidoCocinaToastSession,
} from '../utils/mesaPedidoCocinaToastSession'
import { mesaPedidoCocinaToastClassName } from './mesaPedidoCocinaToastStyles'

type MesaPedidoCocinaToastHostProps = {
  darkMode?: boolean
}

/** Muestra el toast guardado en sesión hasta `expiresAt` (p. ej. tras volver desde el POS). */
export function MesaPedidoCocinaToastHost({
  darkMode = false,
}: MesaPedidoCocinaToastHostProps) {
  const [text, setText] = useState<string | null>(null)

  useEffect(() => {
    const data = getPendingMesaPedidoCocinaToastSession()
    if (!data) return
    setText(data.message)
    const remaining = Math.max(0, data.expiresAt - Date.now())
    const id = window.setTimeout(() => {
      setText(null)
      clearMesaPedidoCocinaToastSession()
    }, remaining)
    return () => window.clearTimeout(id)
  }, [])

  if (!text) return null

  return (
    <div className={mesaPedidoCocinaToastClassName(darkMode)}>
      {text}
    </div>
  )
}
