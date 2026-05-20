'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import type { PedidoParaHistorial } from '../types/pedidos.types'
import { formatGuaranies } from '@/lib/utils/format'

interface PedidoItemDetail {
  id: string
  producto_nombre: string
  cantidad: number
  subtotal: number
  notas: string | null
}

function formatFecha(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const TIPO_LABEL: Record<string, string> = {
  local: 'Local',
  delivery: 'Delivery',
  para_llevar: 'Para llevar',
}

function formatNumeroPedido(numero: number, ciclo: number) {
  if (ciclo <= 1) return `#${numero}`
  return `#${numero} · C${ciclo}`
}

export function PedidoDetailPanel({
  pedido,
  open,
  onClose,
  darkMode,
}: {
  pedido: PedidoParaHistorial | null
  open: boolean
  onClose: () => void
  darkMode: boolean
}) {
  const [items, setItems] = useState<PedidoItemDetail[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open || !pedido?.id) {
      setItems([])
      return
    }
    let cancelled = false
    const supabase = createClient()

    const loadItems = async () => {
      setLoadingItems(true)
      try {
        const { data } = await supabase
          .from('items_pedido')
          .select('id, producto_nombre, cantidad, subtotal, notas')
          .eq('pedido_id', pedido.id)
          .order('created_at', { ascending: true })

        if (cancelled) return
        setItems((data ?? []) as PedidoItemDetail[])
      } finally {
        if (!cancelled) setLoadingItems(false)
      }
    }

    void loadItems()

    return () => {
      cancelled = true
    }
  }, [open, pedido?.id])

  useEffect(() => {
    if (!open) return
    const prevHtmlOverflow = document.documentElement.style.overflow
    const prevBodyOverflow = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow
      document.body.style.overflow = prevBodyOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!mounted || !open || !pedido) return null

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label="Cerrar detalle del pedido"
      />

      <aside
        className={`absolute right-0 top-0 h-full w-full max-w-[94vw] sm:max-w-md border-l shadow-2xl flex flex-col ${
          darkMode
            ? 'bg-gray-900 border-gray-700 text-gray-100'
            : 'bg-white border-gray-200 text-gray-900'
        }`}
      >
        <div className={`px-4 py-3 border-b flex items-start justify-between ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Detalle del pedido</p>
            <h3 className="text-lg font-black">{formatNumeroPedido(pedido.numero_pedido, pedido.pedido_ciclo)}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`h-8 w-8 rounded-full text-lg leading-none flex items-center justify-center ${
              darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            ×
          </button>
        </div>

        <div className={`px-4 py-3 border-b text-sm space-y-1.5 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex justify-between gap-3">
            <span className="text-gray-500 dark:text-gray-400">Fecha</span>
            <span className="font-medium text-right">{formatFecha(pedido.created_at)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-gray-500 dark:text-gray-400">Cliente</span>
            <span className="font-medium text-right">{pedido.cliente_nombre ?? '—'}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-gray-500 dark:text-gray-400">Tipo</span>
            <span className="font-medium text-right">{TIPO_LABEL[pedido.tipo] ?? pedido.tipo}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-gray-500 dark:text-gray-400">Estado</span>
            <span className={`font-semibold ${pedido.estado_pedido === 'ANUL' ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
              {pedido.estado_pedido === 'ANUL' ? 'Anulado' : 'Confirmado'}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-gray-500 dark:text-gray-400">Total</span>
            <span className="font-black">{formatGuaranies(pedido.total)}</span>
          </div>
        </div>

        <div className={`px-4 py-2 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Notas</p>
          <p className="mt-1 text-sm">{pedido.notas?.trim() ? pedido.notas : 'Sin observaciones'}</p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Items</p>
          {loadingItems ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Cargando ítems...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Sin ítems.</p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-xl border p-2.5 ${
                    darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{item.producto_nombre}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">x{item.cantidad}</p>
                    </div>
                    <p className="text-xs font-bold whitespace-nowrap">{formatGuaranies(item.subtotal)}</p>
                  </div>
                  {item.notas && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 italic">{item.notas}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>,
    document.body
  )
}
