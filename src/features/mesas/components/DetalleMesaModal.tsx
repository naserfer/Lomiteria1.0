'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import {
  CalendarClock,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  Loader2,
  Lock,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  SplitSquareHorizontal,
  X,
} from 'lucide-react'
import type { EstadoMesa, Mesa, MesaReserva, ResumenMesa } from '../types/mesas.types'
import { useRealtimeMesaDetalle } from '../hooks/useRealtimeMesaDetalle'

type MetodoCobro = 'tarjeta' | 'efectivo'

export interface DetalleMesaModalProps {
  /** Tenant actual; necesario para suscribir el listener realtime de la mesa. */
  tenantId?: string | null
  mesa: Mesa | null
  reservasMesa: MesaReserva[]
  resumenPedido: ResumenMesa | null
  loadingResumen: boolean
  isSaving?: boolean
  isClosingMesa?: boolean
  isSplitting?: boolean
  partes?: number
  confirmDividir?: boolean
  feedback: { type: 'success' | 'error'; message: string } | null
  onClose: () => void
  /** En modo mesa normal; omitir en `takeawayAccountMode` (no se muestra el botón). */
  onTomarPedido?: (mesaId: string) => void
  onCerrarCuenta?: (mesa: Mesa, metodo?: MetodoCobro) => Promise<void>
  onSetEstado?: (mesaId: string, estado: EstadoMesa) => Promise<void>
  onAdjustSplit?: (mesaId: string, delta: number) => void
  onRequestDividir?: (mesaId: string) => void
  onCancelDividir?: () => void
  onDividir?: (mesaId: string) => Promise<void>
  onUpdateExtraPrecio?: (customizacionId: string, precioExtraGs: number) => Promise<void>
  updatingExtraId?: string | null
  onUpdateItemRecargo?: (
    itemPedidoId: string,
    extraGs: number,
    options?: { mode?: 'line_total' | 'note_extra' }
  ) => Promise<void>
  updatingItemId?: string | null
  onAddProductoManual?: (nombre: string, precioGs: number) => Promise<void>
  addingProductoManual?: boolean
  /** Sustituir la línea por otro producto del catálogo (detalle mesa / cuenta para llevar). */
  onReemplazarProductoCatalogo?: (itemPedidoId: string, nuevoProductoId: string) => Promise<void>
  showOperationalActions?: boolean
  showSplitActions?: boolean
  showCerrarCuenta?: boolean
  /** Cuenta sin mesa (p. ej. para llevar): muestra resumen aunque no haya fila `mesas`, sin realtime de mesa. */
  takeawayAccountMode?: boolean
  /** Encabezado cuando `takeawayAccountMode` (ej. "Para llevar"). */
  accountHeaderEyebrow?: string
  /** Título principal cuando `takeawayAccountMode` (ej. "Pedido #12"). */
  accountHeaderTitle?: string
}

const ESTADO_LABEL: Record<EstadoMesa, string> = {
  libre: 'Libre',
  ocupada: 'Ocupada',
  reservada: 'Reservada',
  bloqueada: 'Bloqueada',
}

const ESTADO_BADGE: Record<EstadoMesa, string> = {
  libre: 'bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-500 dark:border-emerald-500',
  ocupada: 'bg-red-600 text-white border-red-600 dark:bg-red-500 dark:border-red-500',
  reservada: 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500',
  bloqueada: 'bg-gray-500 text-white border-gray-500 dark:bg-gray-600 dark:border-gray-600',
}

const normalizeRecargoText = (value: string) =>
  value
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\bagregado\s+desde\s+notas?\b/g, ' ')
    .replace(/\bnota\b/g, ' ')
    .replace(/\bextra\b/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeExtraDisplayLabel = (value?: string | null) => {
  const raw = (value ?? '').trim()
  if (!raw) return ''
  return raw.replace(/^nota\s*:\s*/i, '').trim()
}

const formatGsInput = (value: string) => {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  const num = Number(digits)
  if (!Number.isFinite(num)) return ''
  return num.toLocaleString('es-PY')
}

const parseGsInput = (value: string) => {
  const digits = value.replace(/\D/g, '')
  if (!digits) return 0
  const parsed = Number(digits)
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0
}

export function DetalleMesaModal({
  tenantId,
  mesa,
  reservasMesa,
  resumenPedido,
  loadingResumen,
  isSaving = false,
  isClosingMesa = false,
  isSplitting = false,
  partes = 2,
  confirmDividir = false,
  feedback,
  onClose,
  onTomarPedido,
  onCerrarCuenta,
  onSetEstado,
  onAdjustSplit,
  onRequestDividir,
  onCancelDividir,
  onDividir,
  onUpdateExtraPrecio,
  updatingExtraId = null,
  onUpdateItemRecargo,
  updatingItemId = null,
  onAddProductoManual,
  addingProductoManual = false,
  onReemplazarProductoCatalogo,
  showOperationalActions = true,
  showSplitActions = true,
  showCerrarCuenta = true,
  takeawayAccountMode = false,
  accountHeaderEyebrow = 'Para llevar',
  accountHeaderTitle = 'Pedido',
}: DetalleMesaModalProps) {
  const lockTakeawayClose =
    takeawayAccountMode && showCerrarCuenta && Boolean(onCerrarCuenta)
  const [mounted, setMounted] = useState(false)
  const [showCloseOptions, setShowCloseOptions] = useState(false)
  const [editingExtraId, setEditingExtraId] = useState<string | null>(null)
  const [editingExtraRowKey, setEditingExtraRowKey] = useState<string | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingNoteItemId, setEditingNoteItemId] = useState<string | null>(null)
  const [extraDraft, setExtraDraft] = useState('')
  const [manualNombre, setManualNombre] = useState('')
  const [manualPrecio, setManualPrecio] = useState('')
  const [realtimeNotice, setRealtimeNotice] = useState<string | null>(null)
  const [pickProductItemId, setPickProductItemId] = useState<string | null>(null)
  const [catalogProducts, setCatalogProducts] = useState<Array<{ id: string; nombre: string; precio: number }>>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [replacingItemId, setReplacingItemId] = useState<string | null>(null)
  const editInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mesa?.id) return
    setShowCloseOptions(false)
    setEditingExtraId(null)
    setEditingExtraRowKey(null)
    setEditingItemId(null)
    setEditingNoteItemId(null)
    setExtraDraft('')
    setManualNombre('')
    setManualPrecio('')
    setRealtimeNotice(null)
    setPickProductItemId(null)
    setCatalogProducts([])
    setCatalogSearch('')
    setReplacingItemId(null)
  }, [mesa?.id])

  // Auto-dismiss del banner realtime tras 6s.
  useEffect(() => {
    if (!realtimeNotice) return
    const t = window.setTimeout(() => setRealtimeNotice(null), 6000)
    return () => window.clearTimeout(t)
  }, [realtimeNotice])

  useEffect(() => {
    if (!pickProductItemId || !tenantId) return
    let cancelled = false
    ;(async () => {
      setCatalogLoading(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('productos')
          .select('id, nombre, precio')
          .eq('tenant_id', tenantId)
          .eq('disponible', true)
          .eq('is_deleted', false)
          .order('nombre')
          .limit(600)
        if (cancelled) return
        if (error) throw error
        setCatalogProducts(
          (data ?? []).map((r) => ({
            id: r.id,
            nombre: r.nombre,
            precio: Number(r.precio ?? 0),
          }))
        )
      } catch {
        if (!cancelled) setCatalogProducts([])
      } finally {
        if (!cancelled) setCatalogLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pickProductItemId, tenantId])

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase()
    if (!q) return catalogProducts
    return catalogProducts.filter((p) => p.nombre.toLowerCase().includes(q))
  }, [catalogProducts, catalogSearch])

  const handleConfirmReemplazoProducto = async (nuevoProductoId: string) => {
    if (!onReemplazarProductoCatalogo || !pickProductItemId) return
    setReplacingItemId(pickProductItemId)
    try {
      await onReemplazarProductoCatalogo(pickProductItemId, nuevoProductoId)
      setPickProductItemId(null)
      setCatalogSearch('')
    } finally {
      setReplacingItemId(null)
    }
  }

  // Listener focalizado en esta mesa: detecta cuando otro usuario cambia su estado.
  useRealtimeMesaDetalle(takeawayAccountMode ? null : tenantId, takeawayAccountMode ? null : mesa, {
    onMesaLiberadaRemoto: (nuevoEstado) => {
      const label = ESTADO_LABEL[nuevoEstado] ?? nuevoEstado
      setRealtimeNotice(`Otro usuario actualizó esta mesa al estado "${label}". Cerrá el detalle cuando quieras.`)
    },
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !lockTakeawayClose) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, lockTakeawayClose])

  useEffect(() => {
    if (!editingItemId && !editingNoteItemId && !editingExtraId) return
    const timer = window.setTimeout(() => {
      if (editInputRef.current) {
        editInputRef.current.focus()
        editInputRef.current.select()
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [editingItemId, editingNoteItemId, editingExtraId])

  const startEditExtra = (customizacionId: string, rowKey: string, _currentExtra: number) => {
    setEditingExtraId(customizacionId)
    setEditingExtraRowKey(rowKey)
    setExtraDraft('')
  }

  const cancelEditExtra = () => {
    setEditingExtraId(null)
    setEditingExtraRowKey(null)
    setExtraDraft('')
  }

  const saveEditExtra = async (customizacionId: string) => {
    if (!onUpdateExtraPrecio) return
    const extraGs = parseGsInput(extraDraft)
    await onUpdateExtraPrecio(customizacionId, extraGs)
    setEditingExtraId(null)
    setEditingExtraRowKey(null)
    setExtraDraft('')
  }

  const startEditItemRecargo = (itemId: string, currentExtra: number) => {
    setEditingItemId(itemId)
    const safe = Math.max(0, Math.round(Number(currentExtra) || 0))
    setExtraDraft(safe > 0 ? safe.toLocaleString('es-PY') : '')
  }

  const cancelEditItemRecargo = () => {
    setEditingItemId(null)
    setExtraDraft('')
  }

  const startEditNoteRecargo = (itemId: string, currentNoteExtra: number) => {
    setEditingNoteItemId(itemId)
    const safe = Math.max(0, Math.round(Number(currentNoteExtra) || 0))
    setExtraDraft(safe > 0 ? safe.toLocaleString('es-PY') : '')
  }

  const cancelEditNoteRecargo = () => {
    setEditingNoteItemId(null)
    setExtraDraft('')
  }

  const saveEditNoteRecargo = async (itemId: string) => {
    if (!onUpdateItemRecargo) return
    const noteExtraGs = parseGsInput(extraDraft)
    await onUpdateItemRecargo(itemId, noteExtraGs, { mode: 'note_extra' })
    setEditingNoteItemId(null)
    setExtraDraft('')
  }

  const saveEditItemRecargo = async (itemId: string) => {
    if (!onUpdateItemRecargo) return
    const extraGs = parseGsInput(extraDraft)
    await onUpdateItemRecargo(itemId, extraGs, { mode: 'line_total' })
    setEditingItemId(null)
    setExtraDraft('')
  }

  const handleAddProductoManual = async () => {
    if (!onAddProductoManual) return
    const nombre = manualNombre.trim()
    const precioGs = Math.max(0, Math.round(Number(manualPrecio) || 0))
    if (!nombre) return
    await onAddProductoManual(nombre, precioGs)
    setManualNombre('')
    setManualPrecio('')
  }

  const estadoBotones = useMemo(() => {
    if (!mesa || !onSetEstado) return null
    if (mesa.estado === 'libre') {
      return (
        <div className="grid grid-cols-3 gap-2">
          <button type="button" disabled={isSaving} onClick={() => void onSetEstado(mesa.id, 'ocupada')} className="rounded-lg border border-red-300 bg-red-100 text-red-800 px-3 py-2 text-xs font-semibold disabled:opacity-50">
            Ocupar
          </button>
          <button type="button" disabled={isSaving} onClick={() => void onSetEstado(mesa.id, 'reservada')} className="rounded-lg border border-blue-300 bg-blue-100 text-blue-800 px-3 py-2 text-xs font-semibold disabled:opacity-50">
            Reservar
          </button>
          <button type="button" disabled={isSaving} onClick={() => void onSetEstado(mesa.id, 'bloqueada')} className="rounded-lg border border-gray-300 bg-gray-100 text-gray-700 px-3 py-2 text-xs font-semibold disabled:opacity-50">
            Bloquear
          </button>
        </div>
      )
    }
    if (mesa.estado === 'ocupada') {
      return (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={isSaving} onClick={() => void onSetEstado(mesa.id, 'libre')} className="rounded-lg border border-emerald-300 bg-emerald-100 text-emerald-800 px-3 py-2 text-xs font-semibold disabled:opacity-50">
            Liberar
          </button>
          <button type="button" disabled={isSaving} onClick={() => void onSetEstado(mesa.id, 'bloqueada')} className="rounded-lg border border-gray-300 bg-gray-100 text-gray-700 px-3 py-2 text-xs font-semibold disabled:opacity-50">
            Bloquear
          </button>
        </div>
      )
    }
    if (mesa.estado === 'reservada') {
      return (
        <div className="grid grid-cols-3 gap-2">
          <button type="button" disabled={isSaving} onClick={() => void onSetEstado(mesa.id, 'libre')} className="rounded-lg border border-emerald-300 bg-emerald-100 text-emerald-800 px-3 py-2 text-xs font-semibold disabled:opacity-50">
            Liberar
          </button>
          <button type="button" disabled={isSaving} onClick={() => void onSetEstado(mesa.id, 'ocupada')} className="rounded-lg border border-red-300 bg-red-100 text-red-800 px-3 py-2 text-xs font-semibold disabled:opacity-50">
            Ocupar
          </button>
          <button type="button" disabled={isSaving} onClick={() => void onSetEstado(mesa.id, 'bloqueada')} className="rounded-lg border border-gray-300 bg-gray-100 text-gray-700 px-3 py-2 text-xs font-semibold disabled:opacity-50">
            Bloquear
          </button>
        </div>
      )
    }
    return (
      <button type="button" disabled={isSaving} onClick={() => void onSetEstado(mesa.id, 'libre')} className="w-full rounded-lg border border-emerald-300 bg-emerald-100 text-emerald-800 px-3 py-2 text-xs font-semibold disabled:opacity-50">
        Liberar mesa
      </button>
    )
  }, [mesa, isSaving, onSetEstado])

  const resumenVisible = takeawayAccountMode
    ? resumenPedido
    : mesa?.estado === 'ocupada'
      ? resumenPedido
      : null
  const loadingResumenVisible = takeawayAccountMode
    ? loadingResumen
    : mesa?.estado === 'ocupada'
      ? loadingResumen
      : false

  if (!mounted || !mesa) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center"
      style={{
        paddingTop:    'max(0.4rem, env(safe-area-inset-top,    0.4rem))',
        paddingBottom: 'max(0.4rem, env(safe-area-inset-bottom, 0.4rem))',
        paddingLeft:   'max(0.4rem, env(safe-area-inset-left,   0.4rem))',
        paddingRight:  'max(0.4rem, env(safe-area-inset-right,  0.4rem))',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="detalle-mesa-title"
    >
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={lockTakeawayClose ? undefined : onClose}
        aria-hidden="true"
      />

      <div className="relative flex w-full max-w-[min(96vw,960px)] max-h-[min(88vh,780px)] flex-col overflow-hidden self-center rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 dark:border-gray-800 px-4 sm:px-5 py-3 sm:py-4">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-gray-400">
              {takeawayAccountMode ? accountHeaderEyebrow : 'Detalle de mesa'}
            </p>
            <h2 id="detalle-mesa-title" className="text-2xl sm:text-4xl font-black mt-0.5 sm:mt-1">
              {takeawayAccountMode ? accountHeaderTitle : `Mesa #${mesa.numero}`}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-semibold ${
                takeawayAccountMode
                  ? 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-200 dark:border-orange-700/50'
                  : ESTADO_BADGE[mesa.estado]
              }`}
            >
              {takeawayAccountMode ? 'Para llevar' : ESTADO_LABEL[mesa.estado]}
            </span>
            <button
              type="button"
              onClick={lockTakeawayClose ? undefined : onClose}
              disabled={lockTakeawayClose}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Cerrar detalle"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}
        >
          <div
            className={`grid grid-cols-1 gap-2 ${
              takeawayAccountMode
                ? showCerrarCuenta
                  ? 'md:grid-cols-2'
                  : 'md:grid-cols-1'
                : showCerrarCuenta
                  ? 'md:grid-cols-3'
                  : 'md:grid-cols-2'
            }`}
          >
            {!takeawayAccountMode && (
              <button
                type="button"
                disabled={mesa.estado === 'bloqueada' || !onTomarPedido}
                onClick={() => onTomarPedido?.(mesa.id)}
                className="rounded-xl bg-gray-900 dark:bg-gray-700 text-white text-sm font-semibold px-3 py-2.5 disabled:opacity-40"
              >
                Tomar pedido
              </button>
            )}
            {showCerrarCuenta && (
              <button
                type="button"
                disabled={
                  !onCerrarCuenta ||
                  (!takeawayAccountMode && mesa.estado !== 'ocupada') ||
                  isClosingMesa
                }
                onClick={() => setShowCloseOptions(prev => !prev)}
                className="rounded-xl border border-emerald-300 bg-emerald-100 text-emerald-800 text-sm font-semibold px-3 py-2.5 disabled:opacity-50 inline-flex items-center justify-center gap-1"
              >
                {isClosingMesa ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Cerrar cuenta
              </button>
            )}
            <button
              type="button"
              onClick={lockTakeawayClose ? undefined : onClose}
              disabled={lockTakeawayClose}
              className="rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold px-3 py-2.5 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {lockTakeawayClose ? 'Cerrá la cuenta para continuar' : 'Volver al panel'}
            </button>
          </div>

          {showCerrarCuenta && showCloseOptions && (takeawayAccountMode || mesa.estado === 'ocupada') && (
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 dark:bg-emerald-900/20 p-2">
              <button
                type="button"
                disabled={!onCerrarCuenta || isClosingMesa}
                onClick={() => onCerrarCuenta ? void onCerrarCuenta(mesa, 'efectivo') : undefined}
                className="rounded-lg border border-emerald-300 bg-white dark:bg-gray-900 text-emerald-700 px-3 py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                Efectivo
              </button>
              <button
                type="button"
                disabled={!onCerrarCuenta || isClosingMesa}
                onClick={() => onCerrarCuenta ? void onCerrarCuenta(mesa, 'tarjeta') : undefined}
                className="rounded-lg border border-emerald-300 bg-white dark:bg-gray-900 text-emerald-700 px-3 py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                Tarjeta
              </button>
            </div>
          )}

          {showOperationalActions && estadoBotones && (
            <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2">
              <h3 className="text-sm font-bold">Acciones de estado</h3>
              {estadoBotones}
              {isSaving && (
                <p className="text-[11px] text-gray-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Guardando...
                </p>
              )}
            </section>
          )}

          <section className="rounded-xl border border-red-200 dark:border-red-900/40 overflow-hidden">
            <div className="px-3 py-2.5 bg-red-50/80 dark:bg-red-950/20">
              <div className="flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                <span className="text-sm font-bold text-red-700 dark:text-red-300">Pedido activo</span>
                {loadingResumenVisible && !resumenVisible && <Loader2 className="w-3 h-3 animate-spin text-red-400" />}
                {resumenVisible && (
                  <span className="text-sm text-red-500 dark:text-red-400">
                    · {resumenVisible.total_items} {resumenVisible.total_items === 1 ? 'item' : 'items'} · Gs. {resumenVisible.total_acumulado.toLocaleString('es-PY')}
                  </span>
                )}
              </div>
            </div>
            <div className="px-3 py-2 bg-white/60 dark:bg-gray-900/40 space-y-1">
              {loadingResumenVisible && !resumenVisible ? (
                <p className="text-[11px] text-gray-400">Cargando resumen...</p>
              ) : !resumenVisible ? (
                <p className="text-[11px] text-gray-400">
                  {takeawayAccountMode ? 'Sin datos de pedido para esta cuenta.' : 'Sin pedido registrado en esta mesa'}
                </p>
              ) : (
                <>
                  {resumenVisible.pedidos.map((pedido, pi) => (
                    <div key={pedido.id}>
                      {resumenVisible.pedidos.length > 1 && (
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-1">Pedido #{pedido.numero_pedido}</p>
                      )}
                      <div className="space-y-0.5">
                        {pedido.items.map(item => {
                          const allExtrasForPrice = (item.customizaciones ?? []).filter((c) => c.tipo === 'extra')
                          const noteExtrasForPrice = allExtrasForPrice.filter((c) => {
                            const extraText = (c.ingrediente_nombre ?? '').trim()
                            return /^nota\s*:/i.test(extraText)
                          })
                          const noteRecargoForPrice = noteExtrasForPrice.reduce(
                            (sum, e) => sum + Math.max(0, Number(e.precio_extra ?? 0)),
                            0
                          )
                          const subtotalSinNota = Math.max(0, Number(item.subtotal) - noteRecargoForPrice)
                          return (
                          <div key={item.id} className="flex items-baseline justify-between gap-1.5 py-0.5">
                            <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 min-w-0">
                              {(() => {
                                return (
                                  <span className="flex items-baseline min-w-0">
                                    <span className="min-w-0 truncate leading-tight">
                                      <span className="font-bold text-red-600 dark:text-red-400">{item.cantidad}x</span>{' '}
                                      {item.producto_nombre}
                                      {onReemplazarProductoCatalogo && tenantId && (
                                        <button
                                          type="button"
                                          className="ml-2 align-middle shrink-0 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-800 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-200 dark:hover:bg-indigo-900/50 disabled:opacity-50"
                                          disabled={Boolean(replacingItemId) || isClosingMesa || Boolean(pickProductItemId)}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setCatalogSearch('')
                                            setPickProductItemId(item.id)
                                          }}
                                        >
                                          Cambiar producto
                                        </button>
                                      )}
                                    </span>
                                    <span
                                      aria-hidden="true"
                                      className="ml-[10px] mr-[10px] h-[1em] flex-1 min-w-[12px] border-b-2 border-dotted border-[#ccc] mb-[0.2em]"
                                    />
                                  </span>
                                )
                              })()}
                              {(() => {
                                const isManualItem = item.is_fuera_carta === true || item.producto_id == null
                                const allExtras = (item.customizaciones ?? []).filter((c) => c.tipo === 'extra')
                                const noteExtras = allExtras.filter((c) => {
                                  const extraText = (c.ingrediente_nombre ?? '').trim()
                                  return /^nota\s*:/i.test(extraText)
                                })
                                const extras = allExtras.filter((c) => !noteExtras.includes(c))
                                const notaTexto = item.notas?.trim() ?? ''
                                const isSystemRecargoNote = /^extra\s+recargo\s+por\s+nota\s*:/i.test(notaTexto)
                                const notaNorm = normalizeRecargoText(notaTexto)
                                const extraNormSet = new Set(
                                  extras
                                    .map((e) => normalizeRecargoText(e.ingrediente_nombre ?? ''))
                                    .filter(Boolean)
                                )
                                const showNotaLine =
                                  !isSystemRecargoNote &&
                                  !isManualItem &&
                                  Boolean(notaNorm) &&
                                  !extraNormSet.has(notaNorm)
                                const base = Number(item.precio_unitario) * Number(item.cantidad)
                                const subtotal = Number(item.subtotal)
                                const totalRecargo = Math.max(0, subtotal - base)
                                const sumExtras = extras.reduce((sum, e) => sum + Math.max(0, Number(e.precio_extra ?? 0)), 0)
                                const noteRecargoFromRows = noteExtras.reduce(
                                  (sum, e) => sum + Math.max(0, Number(e.precio_extra ?? 0)),
                                  0
                                )
                                const noteRecargo = noteRecargoFromRows > 0
                                  ? noteRecargoFromRows
                                  : Math.max(0, totalRecargo - sumExtras)
                                const fallbackToFirstExtra = !isManualItem && extras.length > 0 && noteRecargo > 0
                                const subtotalSinNota = Math.max(0, subtotal - noteRecargo)

                                return (
                                  <>
                                    {extras.map((extra, idx) => {
                                      const rowKey = `${item.id}:${idx}`
                                      const isEditing = editingExtraId === extra.id && editingExtraRowKey === rowKey
                                      const isUpdating = updatingExtraId === extra.id
                                      const extraNombreVisible = normalizeExtraDisplayLabel(extra.ingrediente_nombre)
                                      const extraLabel = extraNombreVisible
                                        ? `Extra ${extraNombreVisible}`
                                        : 'Extra'
                                      const extraVisible = Math.max(
                                        0,
                                        Number(extra.precio_extra ?? 0) + (fallbackToFirstExtra && idx === 0 ? noteRecargo : 0)
                                      )
                                      return (
                                        <span key={extra.id} className="mt-1 block">
                                          {isEditing ? (
                                            <span className="inline-flex items-center gap-1.5">
                                              <label className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                                                {extraLabel}:
                                              </label>
                                              <input
                                                ref={editInputRef}
                                                type="text"
                                                inputMode="numeric"
                                                value={extraDraft}
                                                onChange={(e) => setExtraDraft(formatGsInput(e.target.value))}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') {
                                                    e.preventDefault()
                                                    void saveEditExtra(extra.id)
                                                  }
                                                }}
                                                className="w-32 rounded-md border border-amber-300 bg-white px-3 py-2 text-base text-right text-gray-700 tabular-nums"
                                              />
                                              <button
                                                type="button"
                                                disabled={isUpdating}
                                                onClick={() => void saveEditExtra(extra.id)}
                                                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-100 text-emerald-700 disabled:opacity-60"
                                                aria-label="Guardar extra"
                                              >
                                                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                              </button>
                                              <button
                                                type="button"
                                                disabled={isUpdating}
                                                onClick={cancelEditExtra}
                                                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-300 bg-red-100 text-red-700 disabled:opacity-60"
                                                aria-label="Cancelar edición extra"
                                              >
                                                <X className="h-4 w-4" />
                                              </button>
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-2">
                                              <span className="text-sm text-amber-700 dark:text-amber-400">
                                                {extraLabel}: Gs. {Math.round(extraVisible).toLocaleString('es-PY')}
                                              </span>
                                              <button
                                                type="button"
                                                disabled={!onUpdateExtraPrecio}
                                                onClick={() => onUpdateExtraPrecio ? startEditExtra(extra.id, rowKey, extraVisible) : undefined}
                                                className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 disabled:opacity-50"
                                              >
                                                Editar
                                              </button>
                                            </span>
                                          )}
                                        </span>
                                      )
                                    })}

                                    {showNotaLine && (
                                      <span className="mt-1 block">
                                        {editingNoteItemId === item.id ? (
                                          <span className="inline-flex items-center gap-1.5">
                                            <span className="text-sm text-gray-500">{notaTexto}</span>
                                            <input
                                              ref={editInputRef}
                                              type="text"
                                              inputMode="numeric"
                                              value={extraDraft}
                                              onChange={(e) => setExtraDraft(formatGsInput(e.target.value))}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault()
                                                  void saveEditNoteRecargo(item.id)
                                                }
                                              }}
                                              className="w-32 rounded-md border border-amber-300 bg-white px-3 py-2 text-base text-right text-gray-700 tabular-nums"
                                            />
                                            <button
                                              type="button"
                                              disabled={updatingItemId === item.id}
                                              onClick={() => void saveEditNoteRecargo(item.id)}
                                              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-100 text-emerald-700 disabled:opacity-60"
                                              aria-label="Guardar extra de nota"
                                            >
                                              {updatingItemId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                            </button>
                                            <button
                                              type="button"
                                              disabled={updatingItemId === item.id}
                                              onClick={cancelEditNoteRecargo}
                                              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-300 bg-red-100 text-red-700 disabled:opacity-60"
                                              aria-label="Cancelar extra de nota"
                                            >
                                              <X className="h-4 w-4" />
                                            </button>
                                          </span>
                                        ) : (
                                          <button
                                            type="button"
                                            disabled={!onUpdateItemRecargo}
                                            onClick={() => startEditNoteRecargo(item.id, noteRecargo)}
                                            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-amber-700 dark:hover:text-amber-400 disabled:opacity-50"
                                            aria-label="Ajustar extra de nota"
                                          >
                                            <span>{notaTexto}</span>
                                            <span className="text-amber-700 dark:text-amber-400 tabular-nums">
                                              Gs. {Math.round(noteRecargo).toLocaleString('es-PY')}
                                            </span>
                                            <Pencil className="h-3.5 w-3.5 self-center" />
                                          </button>
                                        )}
                                      </span>
                                    )}

                                  </>
                                )
                              })()}
                            </span>
                            <span className="shrink-0 flex items-center justify-end pl-2">
                              {editingItemId === item.id ? (
                                <span className="inline-flex items-center justify-end gap-2">
                                  <input
                                    ref={editInputRef}
                                    type="text"
                                    inputMode="numeric"
                                    value={extraDraft}
                                    onChange={(e) => setExtraDraft(formatGsInput(e.target.value))}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault()
                                        void saveEditItemRecargo(item.id)
                                      }
                                    }}
                                    className="w-32 rounded-md border border-amber-300 bg-white px-3 py-2 text-base text-right text-gray-700 tabular-nums"
                                  />
                                  <button
                                    type="button"
                                    disabled={updatingItemId === item.id}
                                    onClick={() => void saveEditItemRecargo(item.id)}
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-100 text-emerald-700 disabled:opacity-60"
                                    aria-label="Guardar monto"
                                  >
                                    {updatingItemId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={updatingItemId === item.id}
                                    onClick={cancelEditItemRecargo}
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-300 bg-red-100 text-red-700 disabled:opacity-60"
                                    aria-label="Cancelar edición de monto"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={!onUpdateItemRecargo}
                                  onClick={() => onUpdateItemRecargo ? startEditItemRecargo(item.id, subtotalSinNota) : undefined}
                                  className="inline-flex items-center justify-end gap-1.5 text-sm font-semibold text-gray-600 dark:text-gray-400 tabular-nums hover:text-amber-700 dark:hover:text-amber-400 disabled:opacity-50"
                                  aria-label="Ajustar monto"
                                >
                                  <span>Gs.{Math.round(subtotalSinNota).toLocaleString('es-PY')}</span>
                                  <Pencil className="h-3.5 w-3.5 self-center" />
                                </button>
                              )}
                            </span>
                          </div>
                          )
                        })}
                      </div>
                      {pi < resumenVisible.pedidos.length - 1 && <hr className="border-red-100 dark:border-red-900/30 my-1.5" />}
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1.5 border-t border-red-200 dark:border-red-900/40 mt-1">
                    <span className="text-sm font-bold text-red-700 dark:text-red-300">Total</span>
                    <span className="text-3xl font-black text-red-700 dark:text-red-300 tabular-nums">Gs.{resumenVisible.total_acumulado.toLocaleString('es-PY')}</span>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-amber-200 dark:border-amber-900/40 p-3">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-2">Agregar producto</p>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr,130px,110px] gap-2">
              <input
                type="text"
                value={manualNombre}
                onChange={(e) => setManualNombre(e.target.value)}
                placeholder="Nombre del producto"
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
              <input
                type="number"
                min={0}
                step={1000}
                value={manualPrecio}
                onChange={(e) => setManualPrecio(e.target.value)}
                placeholder="Precio"
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void handleAddProductoManual()}
                disabled={!onAddProductoManual || addingProductoManual || !manualNombre.trim()}
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 disabled:opacity-50"
              >
                {addingProductoManual ? 'Agregando...' : 'Agregar'}
              </button>
            </div>
          </section>

          {showSplitActions && mesa.estado === 'ocupada' && onAdjustSplit && onRequestDividir && onCancelDividir && onDividir && (
            <section className="rounded-xl border border-fuchsia-200 dark:border-fuchsia-900/50 bg-fuchsia-50/60 dark:bg-fuchsia-950/20 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-fuchsia-700 dark:text-fuchsia-400">
                  <SplitSquareHorizontal className="w-3.5 h-3.5" />
                  Dividir entre
                </span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => onAdjustSplit(mesa.id, -1)} disabled={partes <= 2 || confirmDividir || isSplitting} className="w-7 h-7 rounded-lg border border-fuchsia-300 bg-white text-fuchsia-700 flex items-center justify-center disabled:opacity-40">
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm font-bold text-fuchsia-700">{partes}</span>
                  <button type="button" onClick={() => onAdjustSplit(mesa.id, 1)} disabled={partes >= 12 || confirmDividir || isSplitting} className="w-7 h-7 rounded-lg border border-fuchsia-300 bg-white text-fuchsia-700 flex items-center justify-center disabled:opacity-40">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {confirmDividir ? (
                <div className="flex gap-2">
                  <button type="button" onClick={() => void onDividir(mesa.id)} disabled={isSplitting} className="flex-1 rounded-lg bg-fuchsia-600 text-white text-xs font-semibold py-2 disabled:opacity-60 inline-flex items-center justify-center gap-1">
                    {isSplitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    {isSplitting ? 'Dividiendo...' : `Si, dividir en ${partes}`}
                  </button>
                  <button type="button" onClick={onCancelDividir} disabled={isSplitting} className="flex-1 rounded-lg border border-fuchsia-300 text-fuchsia-700 text-xs font-semibold py-2 disabled:opacity-50">
                    Cancelar
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => onRequestDividir(mesa.id)} className="w-full rounded-lg bg-fuchsia-600 text-white text-xs font-semibold py-2">
                  Dividir cuenta en {partes} partes
                </button>
              )}
            </section>
          )}

          {reservasMesa.length > 0 && (
            <section className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/20 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1 inline-flex items-center gap-1">
                <CalendarClock className="w-3.5 h-3.5" />
                Reservas hoy
              </p>
              {reservasMesa.map(r => (
                <p key={r.id} className="text-xs text-blue-700 dark:text-blue-300">
                  {r.nombre_reserva} · {new Date(r.inicio_at).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                </p>
              ))}
            </section>
          )}

          {feedback && (
            <p className={`text-xs font-medium ${feedback.type === 'error' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {feedback.message}
            </p>
          )}

          {realtimeNotice && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
              <RefreshCw className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>{realtimeNotice}</span>
              <button
                type="button"
                onClick={() => setRealtimeNotice(null)}
                className="ml-auto text-amber-900/70 hover:text-amber-900 dark:text-amber-200/70 dark:hover:text-amber-200"
                aria-label="Cerrar aviso"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {pickProductItemId && (
          <div
            className="absolute inset-0 z-[35] flex flex-col justify-end sm:justify-center p-3 sm:p-6 bg-black/50 rounded-3xl"
            onClick={() => {
              setPickProductItemId(null)
              setCatalogSearch('')
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="picker-producto-title"
              className="mx-auto flex max-h-[min(72vh,560px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                <h3 id="picker-producto-title" className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Elegí el producto nuevo
                </h3>
                <button
                  type="button"
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => {
                    setPickProductItemId(null)
                    setCatalogSearch('')
                  }}
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="border-b border-gray-100 px-4 py-2 dark:border-gray-800">
                <input
                  type="search"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Buscar por nombre…"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                  autoFocus
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
                {catalogLoading ? (
                  <p className="py-8 text-center text-sm text-gray-500">
                    <Loader2 className="inline h-5 w-5 animate-spin" /> Cargando carta…
                  </p>
                ) : filteredCatalog.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-500">No hay productos que coincidan.</p>
                ) : (
                  <ul className="space-y-1">
                    {filteredCatalog.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          disabled={replacingItemId !== null}
                          onClick={() => void handleConfirmReemplazoProducto(p.id)}
                          className="flex w-full items-center justify-between gap-2 rounded-xl border border-transparent px-3 py-2.5 text-left text-sm hover:border-indigo-200 hover:bg-indigo-50 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/40 disabled:opacity-50"
                        >
                          <span className="min-w-0 font-medium text-gray-900 dark:text-gray-100">{p.nombre}</span>
                          <span className="shrink-0 tabular-nums text-gray-600 dark:text-gray-400">
                            Gs. {Math.round(p.precio).toLocaleString('es-PY')}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-500 dark:border-gray-800">
                Se descartan extras y modificaciones de esa línea. La cocina recibirá una reimpresión del pedido.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
