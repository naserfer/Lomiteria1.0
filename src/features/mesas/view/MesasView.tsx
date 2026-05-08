'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, Table2, PlusCircle, CalendarClock, CheckCircle2,
  MoveHorizontal, GitMerge, Trash2,
  Link2, Phone, Users, MessageSquare, AlertTriangle, X, Pencil, Eye,
} from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { ROUTES } from '@/config/routes'
import { mesasService } from '../services/mesasService'
import { cerrarCuentaMesaService } from '../services/cerrarCuentaMesaService'
import { DetalleMesaModal } from '../components/DetalleMesaModal'
import { CuentaEditableModal } from '../components/CuentaEditableModal'
import { useRealtimeMesas } from '../hooks/useRealtimeMesas'
import type { EstadoMesa, Mesa, MesaReserva, ResumenMesa } from '../types/mesas.types'
import { MesaPedidoCocinaToastHost } from '@/features/pos/components/MesaPedidoCocinaToastHost'

// ─── Estilos por estado ────────────────────────────────────────────────────────

const ESTADO_BADGE: Record<EstadoMesa, string> = {
  libre:    'bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-500 dark:border-emerald-500',
  ocupada:  'bg-red-600 text-white border-red-600 dark:bg-red-500 dark:border-red-500',
  reservada:'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500',
  bloqueada:'bg-gray-400 text-white border-gray-400 dark:bg-gray-600 dark:border-gray-600',
}

const ESTADO_BORDER: Record<EstadoMesa, string> = {
  libre:    'border-emerald-500 dark:border-emerald-600',
  ocupada:  'border-red-600 dark:border-red-600',
  reservada:'border-blue-500 dark:border-blue-600',
  bloqueada:'border-gray-400 dark:border-gray-700',
}

const ESTADO_CARD_BG: Record<EstadoMesa, string> = {
  libre:    'bg-emerald-50/70 dark:bg-emerald-950/20',
  ocupada:  'bg-red-50/70 dark:bg-red-950/20',
  reservada:'bg-blue-50/50 dark:bg-blue-950/15',
  bloqueada:'bg-gray-50/80 dark:bg-gray-900/70',
}

const ESTADO_LABEL: Record<EstadoMesa, string> = {
  libre: 'Libre', ocupada: 'Ocupada', reservada: 'Reservada', bloqueada: 'Bloqueada',
}

const isVirtualTakeawayMesa = (mesa: Mesa | null | undefined) => {
  const name = (mesa?.nombre ?? '').toLowerCase()
  return name === '__virtual_para_llevar__' || name.includes('virtual_para_llevar')
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function MesasView() {
  const router = useRouter()
  const { tenant, usuario, darkMode } = useTenant()

  // ── Datos ──
  const [loading, setLoading]     = useState(true)
  const [mesas, setMesas]         = useState<Mesa[]>([])
  const [reservas, setReservas]   = useState<MesaReserva[]>([])
  const [unionesActivas, setUnionesActivas] = useState<Array<{ id: string; codigo: string | null; mesas: string[] }>>([])

  // ── Feedback global (solo para ops sin mesa específica) ──
  const [globalError,   setGlobalError]   = useState<string | null>(null)
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null)
  // Feedback por mesa (ops de tarjeta)
  const [mesaFeedbackById, setMesaFeedbackById] = useState<Record<string, { type: 'success' | 'error'; message: string }>>({})

  // ── Loading states ──
  const [savingId,          setSavingId]          = useState<string | null>(null)
  const [splittingMesaId,   setSplittingMesaId]   = useState<string | null>(null)
  const [deletingReservaId, setDeletingReservaId] = useState<string | null>(null)
  const [cancelandoReservaId, setCancelandoReservaId] = useState<string | null>(null)
  const [closingCuentaMesaId, setClosingCuentaMesaId] = useState<string | null>(null)
  const [closeOptionsMesaId, setCloseOptionsMesaId] = useState<string | null>(null)
  const [updatingExtraPrecioId, setUpdatingExtraPrecioId] = useState<string | null>(null)
  const [updatingItemRecargoId, setUpdatingItemRecargoId] = useState<string | null>(null)
  const [addingManualItemMesaId, setAddingManualItemMesaId] = useState<string | null>(null)

  // ── Confirmaciones inline ──
  const [confirmDividirMesaId,  setConfirmDividirMesaId]  = useState<string | null>(null)
  const [confirmCerrarUnionId,  setConfirmCerrarUnionId]  = useState<string | null>(null)

  // ── Formulario nueva mesa ──
  const [showNewMesa,    setShowNewMesa]    = useState(false)
  const [nuevoNumero,    setNuevoNumero]    = useState('')
  const [nuevaCapacidad, setNuevaCapacidad] = useState('4')
  const [nuevoNombre,    setNuevoNombre]    = useState('')

  // ── Formulario reserva ──
  const [reservaMesaId,       setReservaMesaId]       = useState('')
  const [reservaNombre,       setReservaNombre]       = useState('')
  const [reservaAt,           setReservaAt]           = useState('')
  const [reservaTelefono,     setReservaTelefono]     = useState('')
  const [reservaCantPersonas, setReservaCantPersonas] = useState('')
  const [reservaNotas,        setReservaNotas]        = useState('')

  // ── Unión de mesas ──
  const [unionSelection, setUnionSelection] = useState<string[]>([])

  // ── Mover pedido ──
  const [moverMesaOrigenId, setMoverMesaOrigenId] = useState('')
  const [moverMesaId,       setMoverMesaId]       = useState('')

  // ── División de cuenta (partes por mesa) ──
  const [splitPartsByMesa, setSplitPartsByMesa] = useState<Record<string, number>>({})

  // ── Edición inline de mesa ──
  const [editingMesaId,  setEditingMesaId]  = useState<string | null>(null)
  const [editNumero,     setEditNumero]     = useState('')
  const [editNombre,     setEditNombre]     = useState('')
  const [editCapacidad,  setEditCapacidad]  = useState('')
  const [savingEditId,   setSavingEditId]   = useState<string | null>(null)

  // ── Eliminación de mesa ──
  const [confirmDeleteMesaId, setConfirmDeleteMesaId] = useState<string | null>(null)
  const [deletingMesaId,      setDeletingMesaId]      = useState<string | null>(null)

  // ── Resumen de pedidos por mesa ──
  const [resumenByMesa,      setResumenByMesa]      = useState<Record<string, ResumenMesa>>({})
  const [loadingResumen,     setLoadingResumen]     = useState(false)
  const [selectedMesaId,     setSelectedMesaId]     = useState<string | null>(null)

  // ── Auto-limpiar mensajes globales tras 4s ──
  useEffect(() => {
    if (!globalError && !globalSuccess) return
    const t = setTimeout(() => { setGlobalError(null); setGlobalSuccess(null) }, 4000)
    return () => clearTimeout(t)
  }, [globalError, globalSuccess])

  // ── Carga de datos ────────────────────────────────────────────────────────────

  const loadResumenes = useCallback(async (mesasData: Mesa[]) => {
    if (!tenant?.id) return
    const ocupadas = mesasData.filter(m => m.estado === 'ocupada')
    if (ocupadas.length === 0) { setResumenByMesa({}); return }
    setLoadingResumen(true)
    try {
      const data = await mesasService.getResumenPedidosMesas(tenant.id, ocupadas)
      const map: Record<string, ResumenMesa> = {}
      data.forEach(r => { map[r.mesa_id] = r })
      // Diagnóstico defensivo: si una mesa está marcada como ocupada pero el resumen
      // viene vacío, lo registramos. Sirve para detectar cutoffs de sesión mal calculados
      // o pedidos sin mesa_id asociado sin necesidad de tocar la BD.
      const sinResumen = ocupadas.filter(m => !map[m.id])
      if (sinResumen.length > 0) {
        console.warn(
          '[MesasView] Mesas ocupadas sin pedidos en resumen:',
          sinResumen.map(m => ({ id: m.id, numero: m.numero, updated_at: m.updated_at }))
        )
      }
      setResumenByMesa(map)
    } catch (e) {
      console.error('[MesasView] getResumenPedidosMesas:', e)
    } finally {
      setLoadingResumen(false)
    }
  }, [tenant?.id])

  const fetchMesas = useCallback(async () => {
    if (!tenant?.id) return null
    try {
      const data = await mesasService.listMesas(tenant.id)
      setMesas(data)
      return data
    } catch (e: any) {
      setGlobalError(e?.message ?? 'No se pudo cargar la lista de mesas.')
      return null
    }
  }, [tenant?.id])

  const fetchReservas = useCallback(async () => {
    if (!tenant?.id) return
    try {
      const data = await mesasService.listReservas(tenant.id)
      setReservas(data)
    } catch (e) {
      console.error('[MesasView] listReservas:', e)
      setGlobalError('No se pudieron cargar las reservas. Revisá permisos / RLS o la tabla mesa_reservas.')
    }
  }, [tenant?.id])

  const fetchUniones = useCallback(async () => {
    if (!tenant?.id) return
    const unions = await mesasService.listUnionesActivas(tenant.id).catch(() => [])
    setUnionesActivas(unions.map(u => ({ id: u.id, codigo: u.codigo, mesas: u.mesas })))
  }, [tenant?.id])

  const loadData = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const mesasData = await fetchMesas()
      await fetchReservas()
      await fetchUniones()
      if (mesasData) void loadResumenes(mesasData)
    } catch (e: any) {
      setGlobalError(e?.message ?? 'No se pudo cargar el panel de mesas.')
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, fetchMesas, fetchReservas, fetchUniones, loadResumenes])

  useEffect(() => { void loadData() }, [loadData])

  // ── Realtime: stream tenant-level (mesas, pedidos, reservas, uniones, eventos) ─

  const mesasRef = useRef(mesas)
  useEffect(() => { mesasRef.current = mesas }, [mesas])

  useRealtimeMesas(tenant?.id, {
    onMesasChange: () => {
      // Re-fetch lista y resumen porque un cambio de estado puede invalidar el resumen.
      void fetchMesas().then((mesasData) => {
        if (mesasData) void loadResumenes(mesasData)
      })
    },
    onResumenInvalidate: () => {
      void loadResumenes(mesasRef.current)
    },
    onReservasChange: () => {
      void fetchReservas()
    },
    onUnionesChange: () => {
      void fetchUniones()
    },
  })

  // Refresco puntual al abrir el modal para evitar mostrar datos viejos en el detalle.
  // Sólo se dispara al cambiar la mesa seleccionada; los cambios continuos los
  // cubre useRealtimeMesas vía onResumenInvalidate.
  useEffect(() => {
    if (!tenant?.id || !selectedMesaId) return
    const mesaActiva = mesasRef.current.find((m) => m.id === selectedMesaId)
    if (!mesaActiva || mesaActiva.estado !== 'ocupada') return

    let isCancelled = false
    setLoadingResumen(true)

    void mesasService
      .getResumenPedidosMesas(tenant.id, [{ id: mesaActiva.id, updated_at: mesaActiva.updated_at }])
      .then((data) => {
        if (isCancelled) return
        const resumenMesa = data.find((r) => r.mesa_id === mesaActiva.id) ?? null
        setResumenByMesa((prev) => {
          const next = { ...prev }
          if (resumenMesa) next[mesaActiva.id] = resumenMesa
          else delete next[mesaActiva.id]
          return next
        })
      })
      .catch(() => {
        // Silencioso: el modal sigue usable aunque falle este refresh puntual.
      })
      .finally(() => {
        if (!isCancelled) setLoadingResumen(false)
      })

    return () => {
      isCancelled = true
    }
  }, [tenant?.id, selectedMesaId])

  // ── Helpers derivados ─────────────────────────────────────────────────────────

  const setMesaFeedback = useCallback((mesaId: string, type: 'success' | 'error', message: string) => {
    setMesaFeedbackById(prev => ({ ...prev, [mesaId]: { type, message } }))
    // Auto-limpiar después de 10s para dar tiempo a leer alertas importantes.
    setTimeout(() => setMesaFeedbackById(prev => {
      const next = { ...prev }
      delete next[mesaId]
      return next
    }), 10000)
  }, [])

  // IDs de mesas que pertenecen a una unión activa
  const mesasEnUnion = useMemo(() => {
    const set = new Set<string>()
    unionesActivas.forEach(u => u.mesas.forEach(id => set.add(id)))
    return set
  }, [unionesActivas])

  // Reservas pendientes / confirmadas desde HOY en adelante (misma TZ local que el navegador)
  const reservasActivasPorMesa = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const map = new Map<string, MesaReserva[]>()
    for (const r of reservas) {
      if (!['pendiente', 'confirmada'].includes(r.estado)) continue
      const start = new Date(r.inicio_at)
      const dayStart = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
      if (dayStart < startOfToday) continue
      const list = map.get(r.mesa_id) ?? []
      list.push(r)
      map.set(r.mesa_id, list)
    }
    map.forEach((list, mesaId) => {
      list.sort((a, b) => new Date(a.inicio_at).getTime() - new Date(b.inicio_at).getTime())
      map.set(mesaId, list)
    })
    return map
  }, [reservas])

  const reservasOrdenadas = useMemo(
    () =>
      [...reservas].sort((a, b) => {
        const ta = new Date(a.inicio_at).getTime()
        const tb = new Date(b.inicio_at).getTime()
        if (a.estado !== b.estado) {
          const rank = (e: MesaReserva['estado']) =>
            ({ pendiente: 0, confirmada: 1, completada: 2, no_show: 3, cancelada: 4 })[e]
          const ra = rank(a.estado)
          const rb = rank(b.estado)
          if (ra !== rb) return ra - rb
        }
        return ta - tb
      }),
    [reservas]
  )

  const selectedMesa = useMemo(
    () => mesas.find(m => m.id === selectedMesaId) ?? null,
    [mesas, selectedMesaId]
  )
  const selectedIsVirtualTakeaway = isVirtualTakeawayMesa(selectedMesa)

  const resumen = useMemo(() => ({
    total:     mesas.length,
    libres:    mesas.filter(m => m.estado === 'libre').length,
    ocupadas:  mesas.filter(m => m.estado === 'ocupada').length,
    reservadas:mesas.filter(m => m.estado === 'reservada').length,
    bloqueadas:mesas.filter(m => m.estado === 'bloqueada').length,
  }), [mesas])

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const setEstado = useCallback(async (mesaId: string, estado: EstadoMesa) => {
    if (!tenant?.id) return
    // Snapshot del estado previo para rollback si la mutación falla.
    const estadoPrevio = mesasRef.current.find(m => m.id === mesaId)?.estado
    setSavingId(mesaId)
    // Update optimista: pintamos el nuevo estado al instante en quien dispara
    // la acción. Los demás clientes lo reciben por realtime; si la mutación
    // falla revertimos localmente.
    setMesas(prev => prev.map(m => m.id === mesaId ? { ...m, estado } : m))
    try {
      await mesasService.setEstadoMesa(tenant.id, mesaId, estado)
      setMesaFeedback(mesaId, 'success', `Mesa actualizada a ${ESTADO_LABEL[estado]}.`)
    } catch (e: any) {
      if (estadoPrevio) {
        setMesas(prev => prev.map(m => m.id === mesaId ? { ...m, estado: estadoPrevio } : m))
      }
      setMesaFeedback(mesaId, 'error', e?.message ?? 'No se pudo actualizar el estado.')
    } finally {
      setSavingId(null)
    }
  }, [tenant?.id, setMesaFeedback])

  const handleCreateMesa = useCallback(async () => {
    if (!tenant?.id) return
    const numero   = parseInt(nuevoNumero, 10)
    const capacidad = parseInt(nuevaCapacidad, 10)
    if (!Number.isFinite(numero) || numero <= 0)    { setGlobalError('Ingresá un número de mesa válido.'); return }
    if (!Number.isFinite(capacidad) || capacidad <= 0) { setGlobalError('Ingresá una capacidad válida.'); return }
    setSavingId('new')
    setGlobalError(null)
    try {
      const mesa = await mesasService.createMesa({ tenantId: tenant.id, numero, capacidad, nombre: nuevoNombre.trim() || null, orden: numero })
      setMesas(prev => [...prev, mesa].sort((a, b) => a.orden - b.orden || a.numero - b.numero))
      setNuevoNumero(''); setNuevaCapacidad('4'); setNuevoNombre(''); setShowNewMesa(false)
    } catch (e: any) {
      setGlobalError(e?.message ?? 'No se pudo crear la mesa.')
    } finally {
      setSavingId(null)
    }
  }, [tenant?.id, nuevoNumero, nuevaCapacidad, nuevoNombre])

  const handleCreateReserva = useCallback(async () => {
    if (!tenant?.id || !reservaMesaId || !reservaNombre.trim() || !reservaAt) {
      setGlobalError('Completá mesa, nombre y horario para crear la reserva.')
      return
    }
    setSavingId('reserva')
    setGlobalError(null)
    setGlobalSuccess(null)
    try {
      await mesasService.createReserva({
        tenantId:        tenant.id,
        mesaId:          reservaMesaId,
        nombre:          reservaNombre.trim(),
        telefono:        reservaTelefono.trim() || null,
        cantidadPersonas:reservaCantPersonas ? parseInt(reservaCantPersonas, 10) : null,
        notas:           reservaNotas.trim() || null,
        inicioAt:        new Date(reservaAt).toISOString(),
        createdBy:       usuario?.id ?? null,
      })
      setReservaNombre(''); setReservaAt(''); setReservaTelefono('')
      setReservaCantPersonas(''); setReservaNotas('')
      setGlobalSuccess('Reserva creada correctamente.')
      await loadData()
    } catch (e: any) {
      setGlobalError(e?.message ?? 'No se pudo crear la reserva.')
    } finally {
      setSavingId(null)
    }
  }, [tenant?.id, reservaMesaId, reservaNombre, reservaAt, reservaTelefono, reservaCantPersonas, reservaNotas, usuario?.id, loadData])

  const handleCancelarReserva = useCallback(async (reserva: MesaReserva) => {
    if (!tenant?.id) return
    setCancelandoReservaId(reserva.id)
    setGlobalError(null)
    try {
      await mesasService.updateReservaEstado(tenant.id, reserva.id, 'cancelada')
      await loadData()
      setGlobalSuccess('Reserva cancelada.')
    } catch (e: any) {
      setGlobalError(e?.message ?? 'No se pudo cancelar la reserva.')
    } finally {
      setCancelandoReservaId(null)
    }
  }, [tenant?.id, loadData])

  const handleDeleteReserva = useCallback(async (reserva: MesaReserva) => {
    if (!tenant?.id) return
    setDeletingReservaId(reserva.id)
    setGlobalError(null)
    try {
      await mesasService.deleteReserva(tenant.id, reserva.id)
      await loadData()
    } catch (e: any) {
      setGlobalError(e?.message ?? 'No se pudo eliminar la reserva.')
    } finally {
      setDeletingReservaId(null)
    }
  }, [tenant?.id, loadData])

  const handleToggleMesaUnion = (mesaId: string) => {
    setUnionSelection(prev => prev.includes(mesaId) ? prev.filter(id => id !== mesaId) : [...prev, mesaId])
  }

  const handleCrearUnion = useCallback(async () => {
    if (!tenant?.id || unionSelection.length < 2) {
      setGlobalError('Seleccioná al menos dos mesas para crear una unión.')
      return
    }
    setSavingId('union')
    setGlobalError(null)
    setGlobalSuccess(null)
    try {
      await mesasService.crearUnionMesas({ tenantId: tenant.id, mesaIds: unionSelection, usuarioId: usuario?.id ?? null })
      setUnionSelection([])
      setGlobalSuccess('Unión de mesas creada.')
      await loadData()
    } catch (e: any) {
      setGlobalError(e?.message ?? 'No se pudo crear la unión de mesas.')
    } finally {
      setSavingId(null)
    }
  }, [tenant?.id, unionSelection, usuario?.id, loadData])

  const handleCerrarUnion = useCallback(async (unionId: string) => {
    if (!tenant?.id) return
    setSavingId(`close-${unionId}`)
    setConfirmCerrarUnionId(null)
    try {
      await mesasService.cerrarUnionMesas(tenant.id, unionId, usuario?.id ?? null)
      setGlobalSuccess('Unión cerrada. Las mesas volvieron a estado libre.')
      await loadData()
    } catch (e: any) {
      setGlobalError(e?.message ?? 'No se pudo cerrar la unión.')
    } finally {
      setSavingId(null)
    }
  }, [tenant?.id, usuario?.id, loadData])

  const handleMoverPedido = useCallback(async () => {
    if (!tenant?.id || !moverMesaOrigenId || !moverMesaId) {
      setGlobalError('Seleccioná mesa origen y destino.')
      return
    }
    if (moverMesaOrigenId === moverMesaId) {
      setGlobalError('La mesa origen y destino no pueden ser la misma.')
      return
    }
    setSavingId('mover')
    setGlobalError(null)
    setGlobalSuccess(null)
    try {
      await mesasService.moverUltimoPedidoMesa({ tenantId: tenant.id, mesaOrigenId: moverMesaOrigenId, mesaDestinoId: moverMesaId, usuarioId: usuario?.id ?? null })
      setMoverMesaOrigenId(''); setMoverMesaId('')
      setGlobalSuccess('Pedido movido correctamente.')
      await loadData()
    } catch (e: any) {
      setGlobalError(e?.message ?? 'No se pudo mover el pedido.')
    } finally {
      setSavingId(null)
    }
  }, [tenant?.id, moverMesaOrigenId, moverMesaId, usuario?.id, loadData])

  const handleDividirCuenta = useCallback(async (mesaId: string) => {
    if (!tenant?.id) return
    const partes = splitPartsByMesa[mesaId] ?? 2
    setSplittingMesaId(mesaId)
    setConfirmDividirMesaId(null)
    setGlobalError(null)
    try {
      const result = await mesasService.dividirUltimoPedidoMesaEntre({ tenantId: tenant.id, mesaId, partes, createdBy: usuario?.id ?? null })
      const montosTxt = result.montos.map(m => m.toLocaleString('es-PY')).join(' / ')
      setMesaFeedback(mesaId, 'success', `Cuenta dividida en ${result.partes} partes: Gs. ${montosTxt}`)
      await loadData()
    } catch (e: any) {
      const msg = e?.message ?? 'No se pudo dividir la cuenta.'
      setMesaFeedback(mesaId, 'error', msg)
    } finally {
      setSplittingMesaId(null)
    }
  }, [tenant?.id, splitPartsByMesa, usuario?.id, loadData, setMesaFeedback])

  const handleCerrarCuentaMesa = useCallback(async (mesa: Mesa, metodo?: 'tarjeta' | 'efectivo') => {
    if (!tenant?.id) return
    setClosingCuentaMesaId(mesa.id)
    setCloseOptionsMesaId(null)
    setGlobalError(null)
    try {
      const result = await cerrarCuentaMesaService.cerrarCuenta({
        tenantId: tenant.id,
        mesaId: mesa.id,
        usuarioId: usuario?.id ?? null,
        metodoCobro: metodo ?? null,
      })
      const accion = result.warning
        ? 'pendiente/parcial'
        : result.facturaEmitidaAhora
          ? 'emitida e impresa'
          : 'reimpresa'
      setMesaFeedback(
        mesa.id,
        result.warning ? 'error' : 'success',
        result.warning
          ? `Mesa liberada (pedido #${result.numeroPedido}). Atención: ${result.warning}`
          : `Cuenta cerrada (${metodo ?? 'sin método'}) (pedido #${result.numeroPedido}). Factura ${accion}; mesa liberada.`
      )
      if (mesa.nombre === '__virtual_para_llevar__') {
        try {
          await mesasService.deleteVirtualTakeawayMesa({ tenantId: tenant.id, mesaId: mesa.id })
        } catch {
          // no bloquear cierre ya realizado
        }
      }
      await loadData()
      setSelectedMesaId(null)
    } catch (e: any) {
      setMesaFeedback(mesa.id, 'error', e?.message ?? 'No se pudo cerrar la cuenta de la mesa.')
    } finally {
      setClosingCuentaMesaId(null)
    }
  }, [tenant?.id, usuario?.id, loadData, setMesaFeedback])

  const handleUpdateExtraPrecio = useCallback(async (customizacionId: string, precioExtraGs: number) => {
    if (!tenant?.id || !selectedMesa) return
    setUpdatingExtraPrecioId(customizacionId)
    try {
      await mesasService.updateItemCustomizacionExtraPrecio({
        tenantId: tenant.id,
        customizacionId,
        precioExtraGs,
      })
      setMesaFeedback(selectedMesa.id, 'success', `Extra actualizado a Gs. ${precioExtraGs.toLocaleString('es-PY')}.`)
      await loadData()
    } catch (e: any) {
      setMesaFeedback(selectedMesa.id, 'error', e?.message ?? 'No se pudo actualizar el precio del extra.')
    } finally {
      setUpdatingExtraPrecioId(null)
    }
  }, [tenant?.id, selectedMesa, loadData, setMesaFeedback])

  const handleUpdateItemRecargo = useCallback(async (
    itemPedidoId: string,
    extraGs: number,
    options?: { mode?: 'line_total' | 'note_extra' }
  ) => {
    if (!tenant?.id || !selectedMesa) return
    setUpdatingItemRecargoId(itemPedidoId)
    try {
      await mesasService.updateItemPedidoRecargo({
        tenantId: tenant.id,
        itemPedidoId,
        extraGs,
        mode: options?.mode,
      })
      setMesaFeedback(
        selectedMesa.id,
        'success',
        options?.mode === 'note_extra'
          ? `Extra de nota actualizado a Gs. ${extraGs.toLocaleString('es-PY')}.`
          : `Precio actualizado a Gs. ${extraGs.toLocaleString('es-PY')}.`
      )
      await loadData()
    } catch (e: any) {
      setMesaFeedback(selectedMesa.id, 'error', e?.message ?? 'No se pudo actualizar el precio.')
    } finally {
      setUpdatingItemRecargoId(null)
    }
  }, [tenant?.id, selectedMesa, loadData, setMesaFeedback])

  const handleAddProductoManual = useCallback(async (nombre: string, precioGs: number) => {
    if (!tenant?.id || !selectedMesa) return
    setAddingManualItemMesaId(selectedMesa.id)
    try {
      await mesasService.addProductoManualEnMesa({
        tenantId: tenant.id,
        mesaId: selectedMesa.id,
        nombre,
        precioGs,
      })
      setMesaFeedback(selectedMesa.id, 'success', `Producto agregado: ${nombre} (Gs. ${precioGs.toLocaleString('es-PY')}).`)
      await loadData()
    } catch (e: any) {
      setMesaFeedback(selectedMesa.id, 'error', e?.message ?? 'No se pudo agregar el producto.')
    } finally {
      setAddingManualItemMesaId(null)
    }
  }, [tenant?.id, selectedMesa, loadData, setMesaFeedback])

  const handleReemplazarProductoCatalogo = useCallback(
    async (itemPedidoId: string, nuevoProductoId: string) => {
      if (!tenant?.id || !selectedMesa) return
      try {
        await mesasService.reemplazarItemPedidoPorProductoCatalogo({
          tenantId: tenant.id,
          itemPedidoId,
          nuevoProductoId,
        })
        setMesaFeedback(selectedMesa.id, 'success', 'Producto reemplazado; cocina reimpresa.')
        await loadData()
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'No se pudo cambiar el producto.'
        setMesaFeedback(selectedMesa.id, 'error', msg)
      }
    },
    [tenant?.id, selectedMesa, loadData, setMesaFeedback]
  )

  const handleStartEdit = (mesa: Mesa) => {
    setConfirmDeleteMesaId(null)
    setEditingMesaId(mesa.id)
    setEditNumero(String(mesa.numero))
    setEditNombre(mesa.nombre ?? '')
    setEditCapacidad(String(mesa.capacidad))
  }

  const handleCancelEdit = () => {
    setEditingMesaId(null)
    setEditNumero(''); setEditNombre(''); setEditCapacidad('')
  }

  const handleSaveEdit = useCallback(async (mesaId: string) => {
    if (!tenant?.id) return
    const numero   = parseInt(editNumero, 10)
    const capacidad = parseInt(editCapacidad, 10)
    if (!Number.isFinite(numero)   || numero   <= 0) { setGlobalError('Número de mesa inválido.'); return }
    if (!Number.isFinite(capacidad) || capacidad <= 0) { setGlobalError('Capacidad inválida.'); return }
    setSavingEditId(mesaId)
    try {
      const updated = await mesasService.updateMesa(tenant.id, mesaId, {
        numero,
        nombre: editNombre.trim() || null,
        capacidad,
      })
      setMesas(prev => prev.map(m => m.id === mesaId ? updated : m))
      setEditingMesaId(null)
      setMesaFeedback(mesaId, 'success', 'Mesa actualizada.')
    } catch (e: any) {
      setGlobalError(e?.message ?? 'No se pudo actualizar la mesa.')
    } finally {
      setSavingEditId(null)
    }
  }, [tenant?.id, editNumero, editNombre, editCapacidad, setMesaFeedback])

  const handleDeleteMesa = useCallback(async (mesaId: string) => {
    if (!tenant?.id) return
    setDeletingMesaId(mesaId)
    setConfirmDeleteMesaId(null)
    try {
      await mesasService.deleteMesa({ tenantId: tenant.id, mesaId, deletedBy: usuario?.id ?? null })
      setMesas(prev => prev.filter(m => m.id !== mesaId))
    } catch (e: any) {
      setGlobalError(e?.message ?? 'No se pudo eliminar la mesa.')
    } finally {
      setDeletingMesaId(null)
    }
  }, [tenant?.id, usuario?.id])

  const adjustSplit = (mesaId: string, delta: number) => {
    setSplitPartsByMesa(prev => {
      const current = prev[mesaId] ?? 2
      const next = Math.min(12, Math.max(2, current + delta))
      return { ...prev, [mesaId]: next }
    })
  }

  const goToMesaPOS = useCallback((mesaId: string) => {
    router.push(`${ROUTES.PROTECTED.POS}?mesaId=${mesaId}&from=${ROUTES.POS_FROM.MESAS_VIEW}`)
  }, [router])

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-6">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* ── Header ── */}
          <header className="rounded-3xl border border-white/40 dark:border-gray-800 bg-white/80 dark:bg-gray-900/70 backdrop-blur p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-orange-500">Panel Mesas</p>
                <h1 className="text-3xl font-black tracking-tight mt-1">
                  Operación de salón {tenant?.nombre ? `· ${tenant.nombre}` : ''}
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
                  Gestioná ocupación, reservas y toma de pedidos por mesa.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => router.push(ROUTES.PROTECTED.POS)}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  Ir al POS directo
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewMesa(prev => !prev)}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition"
                >
                  <PlusCircle className="w-4 h-4" />
                  Nueva mesa
                </button>
              </div>
            </div>

            {/* Resumen badges */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5">
              {[
                { label: 'Total',     value: resumen.total,      cls: '' },
                { label: 'Libres',    value: resumen.libres,     cls: 'text-emerald-600 dark:text-emerald-400' },
                { label: 'Ocupadas',  value: resumen.ocupadas,   cls: 'text-orange-600 dark:text-orange-400' },
                { label: 'Reservadas',value: resumen.reservadas, cls: 'text-blue-600 dark:text-blue-400' },
                { label: 'Bloqueadas',value: resumen.bloqueadas, cls: 'text-rose-600 dark:text-rose-400' },
              ].map(({ label, value, cls }) => (
                <div key={label} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
                  <p className={`text-lg font-bold ${cls || 'text-gray-900 dark:text-white'}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Formulario nueva mesa */}
            {showNewMesa && (
              <div className="mt-5 rounded-2xl border border-orange-200 dark:border-orange-900/60 bg-orange-50/70 dark:bg-orange-950/20 p-4">
                <p className="text-sm font-semibold mb-3">Crear mesa</p>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input type="number" min={1} value={nuevoNumero} onChange={e => setNuevoNumero(e.target.value)} placeholder="Número" className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm" />
                  <input type="text" value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} placeholder="Alias (opcional)" className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm" />
                  <input type="number" min={1} value={nuevaCapacidad} onChange={e => setNuevaCapacidad(e.target.value)} placeholder="Capacidad" className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm" />
                  <button type="button" onClick={handleCreateMesa} disabled={savingId === 'new'} className="rounded-xl bg-emerald-600 text-white text-sm font-semibold px-3 py-2.5 hover:bg-emerald-700 transition disabled:opacity-60">
                    {savingId === 'new' ? 'Creando...' : 'Guardar mesa'}
                  </button>
                </div>
              </div>
            )}
          </header>

          {/* ── Feedback global (auto-dismiss 4s) ── */}
          {globalError && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="flex-1">{globalError}</span>
              <button type="button" onClick={() => setGlobalError(null)} className="shrink-0 opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
            </div>
          )}
          {globalSuccess && (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="flex-1">{globalSuccess}</span>
              <button type="button" onClick={() => setGlobalSuccess(null)} className="shrink-0 opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* ── Grid de mesas ── */}
          {loading ? (
            <div className="rounded-3xl border border-white/40 dark:border-gray-800 bg-white/80 dark:bg-gray-900/70 p-10 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : mesas.length === 0 ? (
            <div className="rounded-3xl border border-white/40 dark:border-gray-800 bg-white/80 dark:bg-gray-900/70 p-10 text-center">
              <Table2 className="mx-auto w-10 h-10 text-gray-400 mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No hay mesas creadas aún.</p>
            </div>
          ) : (
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {mesas.map(mesa => {
                const isVirtualTakeaway = isVirtualTakeawayMesa(mesa)
                const reservasMesa  = reservasActivasPorMesa.get(mesa.id) ?? []
                const enUnion       = mesasEnUnion.has(mesa.id)
                const feedback      = mesaFeedbackById[mesa.id]
                const isClosingMesa = closingCuentaMesaId === mesa.id
                const isEditing     = editingMesaId === mesa.id
                const isSavingEdit  = savingEditId === mesa.id
                const confirmDelete = confirmDeleteMesaId === mesa.id
                const isDeleting    = deletingMesaId === mesa.id
                const showCloseOptions = closeOptionsMesaId === mesa.id
                const cardBorder = isVirtualTakeaway
                  ? (darkMode ? 'border-amber-500' : 'border-amber-400')
                  : ESTADO_BORDER[mesa.estado]
                const cardBg = isVirtualTakeaway
                  ? (darkMode ? 'bg-amber-950/20' : 'bg-amber-50/90')
                  : ESTADO_CARD_BG[mesa.estado]
                const estadoBadge = isVirtualTakeaway
                  ? 'bg-amber-500 text-white border-amber-500 dark:bg-amber-500 dark:border-amber-500'
                  : ESTADO_BADGE[mesa.estado]
                const estadoLabel = isVirtualTakeaway ? 'Para llevar' : ESTADO_LABEL[mesa.estado]
                const headerEyebrow = isVirtualTakeaway ? 'Para llevar' : 'Mesa'
                const headerTitle = isVirtualTakeaway ? 'Para llevar' : `#${mesa.numero}`

                return (
                  <article
                    key={mesa.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedMesaId(mesa.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedMesaId(mesa.id)
                      }
                    }}
                    className={`rounded-3xl border-[3px] p-5 shadow-sm flex flex-col gap-3 transition-colors cursor-pointer ${cardBorder} ${cardBg}`}
                  >
                    {/* Cabecera de tarjeta */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500">{headerEyebrow}</p>
                        <h3 className="text-3xl font-black leading-none mt-0.5">{headerTitle}</h3>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoBadge}`}>
                          {estadoLabel}
                        </span>
                        {enUnion && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 px-2 py-0.5 text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                            <Link2 className="w-3 h-3" />
                            Unión activa
                          </span>
                        )}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              isEditing ? handleCancelEdit() : handleStartEdit(mesa)
                            }}
                            title={isEditing ? 'Cancelar edición' : 'Editar mesa'}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-950/30 transition"
                          >
                            {isEditing ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingMesaId(null)
                              setConfirmDeleteMesaId(mesa.id)
                            }}
                            disabled={isDeleting}
                            title="Eliminar mesa"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* ── Modo edición inline ── */}
                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide mb-1 block">Número</label>
                            <input
                              type="number"
                              min={1}
                              value={editNumero}
                              onChange={e => setEditNumero(e.target.value)}
                              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide mb-1 block">Capacidad</label>
                            <input
                              type="number"
                              min={1}
                              value={editCapacidad}
                              onChange={e => setEditCapacidad(e.target.value)}
                              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-2 text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide mb-1 block">Alias (opcional)</label>
                          <input
                            type="text"
                            value={editNombre}
                            onChange={e => setEditNombre(e.target.value)}
                            placeholder="Ej: Ventana, Terraza…"
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-2 text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => void handleSaveEdit(mesa.id)}
                            disabled={isSavingEdit}
                            className="rounded-lg bg-emerald-600 text-white text-xs font-semibold py-2 hover:bg-emerald-700 transition disabled:opacity-60 inline-flex items-center justify-center gap-1"
                          >
                            {isSavingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            {isSavingEdit ? 'Guardando…' : 'Guardar'}
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            disabled={isSavingEdit}
                            className="rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : confirmDelete ? (
                      /* ── Confirmación eliminación inline ── */
                      <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/20 p-3 space-y-2">
                        <p className="text-xs font-semibold text-red-700 dark:text-red-300 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          ¿Eliminar mesa #{mesa.numero}?
                        </p>
                        <p className="text-[11px] text-red-600 dark:text-red-400 leading-snug">
                          Se desactivará la mesa. Esta acción no se puede deshacer.
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => void handleDeleteMesa(mesa.id)}
                            disabled={isDeleting}
                            className="rounded-lg bg-red-600 text-white text-xs font-semibold py-2 hover:bg-red-700 transition disabled:opacity-60 inline-flex items-center justify-center gap-1"
                          >
                            {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            {isDeleting ? 'Eliminando…' : 'Sí, eliminar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteMesaId(null)}
                            disabled={isDeleting}
                            className="rounded-lg border border-red-200 dark:border-red-800 text-xs font-semibold py-2 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── Vista normal simplificada: reservas + acciones rápidas ── */
                      <>
                        {/* Próximas reservas (desde hoy) */}
                        {reservasMesa.length > 0 && (
                          <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/20 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1">
                              Próximas reservas
                            </p>
                            {reservasMesa.slice(0, 2).map(r => (
                              <p key={r.id} className="text-xs text-blue-700 dark:text-blue-300">
                                {r.nombre_reserva} · {new Date(r.inicio_at).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            ))}
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            disabled={mesa.estado === 'bloqueada'}
                            onClick={(e) => {
                              e.stopPropagation()
                              goToMesaPOS(mesa.id)
                            }}
                            className="rounded-xl bg-gray-900 dark:bg-gray-700 text-white text-xs font-semibold px-2.5 py-2 hover:opacity-90 transition disabled:opacity-40"
                          >
                            Tomar pedido
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedMesaId(mesa.id)
                            }}
                            className="rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold px-2.5 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition inline-flex items-center justify-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Ver detalle
                          </button>
                          <button
                            type="button"
                            disabled={mesa.estado !== 'ocupada' || isClosingMesa}
                            onClick={(e) => {
                              e.stopPropagation()
                              setCloseOptionsMesaId(prev => (prev === mesa.id ? null : mesa.id))
                            }}
                            className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 px-2.5 py-2 text-xs font-semibold hover:bg-emerald-100 transition dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300 disabled:opacity-50 inline-flex items-center justify-center gap-1"
                          >
                            {isClosingMesa ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            Cerrar cuenta
                          </button>
                        </div>

                        {showCloseOptions && mesa.estado === 'ocupada' && (
                          <div className="grid grid-cols-2 gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 dark:bg-emerald-900/20 p-2">
                            <button
                              type="button"
                              disabled={isClosingMesa}
                              onClick={(e) => {
                                e.stopPropagation()
                                void handleCerrarCuentaMesa(mesa, 'efectivo')
                              }}
                              className="rounded-lg border border-emerald-300 bg-white dark:bg-gray-900 text-emerald-700 px-2.5 py-2 text-xs font-semibold disabled:opacity-50"
                            >
                              Efectivo
                            </button>
                            <button
                              type="button"
                              disabled={isClosingMesa}
                              onClick={(e) => {
                                e.stopPropagation()
                                void handleCerrarCuentaMesa(mesa, 'tarjeta')
                              }}
                              className="rounded-lg border border-emerald-300 bg-white dark:bg-gray-900 text-emerald-700 px-2.5 py-2 text-xs font-semibold disabled:opacity-50"
                            >
                              Tarjeta
                            </button>
                          </div>
                        )}

                        {/* Feedback por mesa */}
                        {feedback && (
                          <p className={`text-[11px] font-medium ${feedback.type === 'error' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {feedback.message}
                          </p>
                        )}
                      </>
                    )}
                  </article>
                )
              })}
            </section>
          )}

          {selectedIsVirtualTakeaway ? (
            <CuentaEditableModal
              tenantId={tenant?.id ?? null}
              mesa={selectedMesa}
              resumenPedido={selectedMesa ? (resumenByMesa[selectedMesa.id] ?? null) : null}
              loadingResumen={loadingResumen}
              isClosingMesa={selectedMesa ? closingCuentaMesaId === selectedMesa.id : false}
              feedback={selectedMesa ? (mesaFeedbackById[selectedMesa.id] ?? null) : null}
              onClose={() => {
                setSelectedMesaId(null)
                setConfirmDividirMesaId(null)
              }}
              onCerrarCuenta={handleCerrarCuentaMesa}
              onUpdateExtraPrecio={handleUpdateExtraPrecio}
              updatingExtraId={updatingExtraPrecioId}
              onUpdateItemRecargo={handleUpdateItemRecargo}
              updatingItemId={updatingItemRecargoId}
              onAddProductoManual={handleAddProductoManual}
              addingProductoManual={selectedMesa ? addingManualItemMesaId === selectedMesa.id : false}
              onReemplazarProductoCatalogo={handleReemplazarProductoCatalogo}
              showCerrarCuenta
              accountHeaderEyebrow="Cuenta para llevar"
              accountHeaderTitle={
                selectedMesa && resumenByMesa[selectedMesa.id]?.pedidos?.[0]
                  ? `Pedido #${resumenByMesa[selectedMesa.id].pedidos[0].numero_pedido}`
                  : 'Pedido'
              }
            />
          ) : (
            <DetalleMesaModal
              tenantId={tenant?.id ?? null}
              mesa={selectedMesa}
              reservasMesa={selectedMesa ? (reservasActivasPorMesa.get(selectedMesa.id) ?? []) : []}
              resumenPedido={selectedMesa ? (resumenByMesa[selectedMesa.id] ?? null) : null}
              loadingResumen={loadingResumen}
              isSaving={selectedMesa ? savingId === selectedMesa.id : false}
              isClosingMesa={selectedMesa ? closingCuentaMesaId === selectedMesa.id : false}
              isSplitting={selectedMesa ? splittingMesaId === selectedMesa.id : false}
              partes={selectedMesa ? (splitPartsByMesa[selectedMesa.id] ?? 2) : 2}
              confirmDividir={selectedMesa ? confirmDividirMesaId === selectedMesa.id : false}
              feedback={selectedMesa ? (mesaFeedbackById[selectedMesa.id] ?? null) : null}
              onClose={() => {
                setSelectedMesaId(null)
                setConfirmDividirMesaId(null)
              }}
              onTomarPedido={goToMesaPOS}
              onCerrarCuenta={handleCerrarCuentaMesa}
              onSetEstado={setEstado}
              onAdjustSplit={adjustSplit}
              onRequestDividir={setConfirmDividirMesaId}
              onCancelDividir={() => setConfirmDividirMesaId(null)}
              onDividir={handleDividirCuenta}
              onUpdateExtraPrecio={handleUpdateExtraPrecio}
              updatingExtraId={updatingExtraPrecioId}
              onUpdateItemRecargo={handleUpdateItemRecargo}
              updatingItemId={updatingItemRecargoId}
              onAddProductoManual={handleAddProductoManual}
              addingProductoManual={selectedMesa ? addingManualItemMesaId === selectedMesa.id : false}
              onReemplazarProductoCatalogo={handleReemplazarProductoCatalogo}
            />
          )}

          {/* ── Reservas: formulario + listado lado a lado (desktop) ── */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* Alta de reserva (izquierda en lg) */}
            <article className="rounded-3xl border border-white/40 dark:border-gray-800 bg-white/85 dark:bg-gray-900/70 p-5 space-y-3 min-w-0">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-blue-500" />
                <h3 className="font-bold">Nueva reserva</h3>
              </div>

              <select value={reservaMesaId} onChange={e => setReservaMesaId(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm">
                <option value="">Seleccionar mesa</option>
                {mesas.map(m => <option key={m.id} value={m.id}>Mesa #{m.numero}{m.nombre ? ` · ${m.nombre}` : ''}</option>)}
              </select>

              <input value={reservaNombre} onChange={e => setReservaNombre(e.target.value)} placeholder="Nombre de la reserva *" className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm" />

              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input value={reservaTelefono} onChange={e => setReservaTelefono(e.target.value)} placeholder="Teléfono" className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-8 pr-3 py-2.5 text-sm" />
                </div>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input type="number" min={1} value={reservaCantPersonas} onChange={e => setReservaCantPersonas(e.target.value)} placeholder="Personas" className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-8 pr-3 py-2.5 text-sm" />
                </div>
              </div>

              <input type="datetime-local" value={reservaAt} onChange={e => setReservaAt(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm" />

              <div className="relative">
                <MessageSquare className="absolute left-3 top-3 w-3.5 h-3.5 text-gray-400" />
                <textarea value={reservaNotas} onChange={e => setReservaNotas(e.target.value)} placeholder="Notas (silla alta, cumpleaños…)" rows={2} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-8 pr-3 py-2.5 text-sm resize-none" />
              </div>

              <button type="button" onClick={() => void handleCreateReserva()} disabled={savingId === 'reserva'} className="w-full rounded-xl bg-blue-600 text-white py-2.5 text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60">
                {savingId === 'reserva' ? 'Guardando…' : 'Crear reserva'}
              </button>
            </article>

            {/* Panel de listado (derecha en lg): visible junto al formulario */}
            <div className="rounded-3xl border border-white/40 dark:border-gray-800 bg-white/85 dark:bg-gray-900/70 p-5 min-w-0 flex flex-col max-h-[min(70vh,640px)] lg:max-h-[min(80vh,720px)]">
              <div className="flex items-start justify-between gap-2 shrink-0 mb-3">
                <h3 className="font-bold text-lg leading-tight">Panel de reservas</h3>
                {!loading && (
                  <span className="text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 px-2.5 py-0.5 tabular-nums">
                    {reservas.length}
                  </span>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2 -mr-1">
                {reservasOrdenadas.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No hay reservas registradas.</p>
                ) : (
                  reservasOrdenadas.map(reserva => {
                      const inicio = new Date(reserva.inicio_at)
                      const now = new Date()
                      const isPast = inicio.getTime() <= now.getTime()
                      const isCancelled = reserva.estado === 'cancelada'
                      const mesa = mesas.find(m => m.id === reserva.mesa_id)
                      const isCancelling = cancelandoReservaId === reserva.id
                      const isDeleting = deletingReservaId === reserva.id

                      return (
                        <div
                          key={reserva.id}
                          className={`rounded-xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 transition ${
                            isCancelled
                              ? 'border-gray-200 dark:border-gray-700 opacity-50'
                              : 'border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">
                              {reserva.nombre_reserva}
                              <span className="font-normal text-gray-500"> · Mesa #{mesa?.numero ?? '?'}</span>
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {inicio.toLocaleString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              {reserva.telefono && ` · ${reserva.telefono}`}
                              {reserva.cantidad_personas != null && reserva.cantidad_personas > 0 && ` · ${reserva.cantidad_personas} personas`}
                              {' · '}
                              <span className={isCancelled ? 'text-rose-500' : isPast ? 'text-gray-400' : 'text-blue-500'}>
                                {isCancelled ? 'Cancelada' : isPast ? 'Pasada / en curso' : reserva.estado}
                              </span>
                            </p>
                            {reserva.notas && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 italic">&quot;{reserva.notas}&quot;</p>
                            )}
                          </div>

                          {!isCancelled && (
                            <div className="flex items-center gap-2">
                              {!isPast && (
                                <button
                                  type="button"
                                  onClick={() => void handleCancelarReserva(reserva)}
                                  disabled={isCancelling}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 px-3 py-1.5 text-xs font-semibold disabled:opacity-50 transition hover:bg-amber-100 dark:hover:bg-amber-900/30"
                                >
                                  {isCancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                                  {isCancelling ? 'Cancelando…' : 'Cancelar'}
                                </button>
                              )}
                              {isPast && (
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteReserva(reserva)}
                                  disabled={isDeleting}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 px-3 py-1.5 text-xs font-semibold disabled:opacity-50 transition hover:bg-red-100 dark:hover:bg-red-900/30"
                                >
                                  {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                  {isDeleting ? 'Eliminando…' : 'Eliminar'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })
                )}
              </div>
            </div>

            {/* Panel: Unión de mesas — comentado temporalmente
            <article className="rounded-3xl border border-white/40 dark:border-gray-800 bg-white/85 dark:bg-gray-900/70 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <GitMerge className="w-4 h-4 text-violet-500" />
                <h3 className="font-bold">Unión de mesas</h3>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {mesas.filter(m => m.estado !== 'bloqueada').map(m => (
                  <label key={m.id} className="inline-flex items-center gap-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                    <input type="checkbox" checked={unionSelection.includes(m.id)} onChange={() => handleToggleMesaUnion(m.id)} />
                    Mesa #{m.numero}
                  </label>
                ))}
              </div>

              <button type="button" onClick={() => void handleCrearUnion()} disabled={savingId === 'union' || unionSelection.length < 2} className="w-full rounded-xl bg-violet-600 text-white py-2.5 text-sm font-semibold hover:bg-violet-700 transition disabled:opacity-60">
                {savingId === 'union' ? 'Creando unión…' : `Unir ${unionSelection.length > 0 ? `${unionSelection.length} ` : ''}mesas seleccionadas`}
              </button>

              <div className="space-y-2">
                {unionesActivas.map(union => {
                  const isClosing    = savingId === `close-${union.id}`
                  const confirmClose = confirmCerrarUnionId === union.id
                  return (
                    <div key={union.id} className="rounded-xl border border-violet-200/70 dark:border-violet-800/60 bg-violet-50/60 dark:bg-violet-950/20 px-3 py-2.5">
                      <p className="text-xs font-semibold text-violet-800 dark:text-violet-300">
                        Unión {union.codigo || union.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        Mesas: {union.mesas.map(id => mesas.find(m => m.id === id)?.numero ?? '?').join(', ')}
                      </p>
                      {confirmClose ? (
                        <div className="flex gap-2 mt-2">
                          <button type="button" onClick={() => void handleCerrarUnion(union.id)} disabled={isClosing} className="flex-1 rounded-lg bg-violet-600 text-white text-xs font-semibold py-1.5 hover:bg-violet-700 transition disabled:opacity-60 inline-flex items-center justify-center gap-1">
                            {isClosing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            {isClosing ? 'Cerrando…' : 'Confirmar cierre'}
                          </button>
                          <button type="button" onClick={() => setConfirmCerrarUnionId(null)} className="flex-1 rounded-lg border border-violet-300 dark:border-violet-700 text-xs font-semibold py-1.5 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition">
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setConfirmCerrarUnionId(union.id)} disabled={isClosing} className="mt-2 w-full rounded-lg border border-violet-300 dark:border-violet-700 px-2.5 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition disabled:opacity-50">
                          Cerrar unión
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </article>
            */}

            {/* Panel: Mover pedido entre mesas — comentado temporalmente
            <article className="rounded-3xl border border-white/40 dark:border-gray-800 bg-white/85 dark:bg-gray-900/70 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <MoveHorizontal className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold">Mover pedido entre mesas</h3>
              </div>
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 p-3 space-y-2">
                <select value={moverMesaOrigenId} onChange={e => setMoverMesaOrigenId(e.target.value)} className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-2 text-xs">
                  <option value="">Mesa origen (ocupada)</option>
                  {mesas.filter(m => m.estado === 'ocupada').map(m => <option key={m.id} value={m.id}>Mesa #{m.numero}</option>)}
                </select>
                <select value={moverMesaId} onChange={e => setMoverMesaId(e.target.value)} className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-2 text-xs">
                  <option value="">Mesa destino</option>
                  {mesas.filter(m => m.estado !== 'bloqueada' && m.id !== moverMesaOrigenId).map(m => <option key={m.id} value={m.id}>Mesa #{m.numero}</option>)}
                </select>
                <button type="button" onClick={() => void handleMoverPedido()} disabled={savingId === 'mover'} className="w-full rounded-lg bg-amber-600 text-white py-2 text-xs font-semibold hover:bg-amber-700 transition disabled:opacity-60">
                  {savingId === 'mover' ? 'Moviendo…' : 'Mover pedido'}
                </button>
              </div>
            </article>
            */}
          </section>

        </div>
      </div>
    </div>
    <MesaPedidoCocinaToastHost darkMode={darkMode} />
    </>
  )
}
