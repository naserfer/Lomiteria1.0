'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Table2, PlusCircle, CircleDot, Lock, CalendarClock, CheckCircle2, MoveHorizontal, GitMerge, Trash2 } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { ROUTES } from '@/config/routes'
import { mesasService } from '../services/mesasService'
import type { EstadoMesa, Mesa, MesaReserva } from '../types/mesas.types'

const ESTADO_STYLES: Record<EstadoMesa, string> = {
  libre: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  ocupada: 'bg-orange-100 text-orange-700 border-orange-200',
  reservada: 'bg-blue-100 text-blue-700 border-blue-200',
  bloqueada: 'bg-rose-100 text-rose-700 border-rose-200',
}

const ESTADO_LABEL: Record<EstadoMesa, string> = {
  libre: 'Libre',
  ocupada: 'Ocupada',
  reservada: 'Reservada',
  bloqueada: 'Bloqueada',
}

export default function MesasView() {
  const router = useRouter()
  const { tenant, usuario } = useTenant()
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [reservas, setReservas] = useState<MesaReserva[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showNewMesa, setShowNewMesa] = useState(false)
  const [nuevoNumero, setNuevoNumero] = useState('')
  const [nuevaCapacidad, setNuevaCapacidad] = useState('4')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [reservaMesaId, setReservaMesaId] = useState('')
  const [reservaNombre, setReservaNombre] = useState('')
  const [reservaAt, setReservaAt] = useState('')
  const [unionSelection, setUnionSelection] = useState<string[]>([])
  const [unionesActivas, setUnionesActivas] = useState<Array<{ id: string; codigo: string | null; mesas: string[] }>>([])
  const [moverMesaOrigenId, setMoverMesaOrigenId] = useState('')
  const [moverMesaId, setMoverMesaId] = useState('')
  const [splitPartsByMesa, setSplitPartsByMesa] = useState<Record<string, string>>({})
  const [splittingMesaId, setSplittingMesaId] = useState<string | null>(null)
  const [deletingReservaId, setDeletingReservaId] = useState<string | null>(null)
  const [expandedActionsByMesa, setExpandedActionsByMesa] = useState<Record<string, boolean>>({})
  const [mesaFeedbackById, setMesaFeedbackById] = useState<Record<string, { type: 'success' | 'error'; message: string }>>({})

  const setMesaFeedback = useCallback((mesaId: string, type: 'success' | 'error', message: string) => {
    setMesaFeedbackById((prev) => ({
      ...prev,
      [mesaId]: { type, message }
    }))
  }, [])

  const loadData = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const [mesasData, reservasData] = await Promise.all([
        mesasService.listMesas(tenant.id),
        mesasService.listReservas(tenant.id).catch(() => [] as MesaReserva[]),
      ])
      setMesas(mesasData)
      setReservas(reservasData)
      const unions = await mesasService.listUnionesActivas(tenant.id).catch(() => [])
      setUnionesActivas(unions.map((u) => ({ id: u.id, codigo: u.codigo, mesas: u.mesas })))
    } catch (error: any) {
      setErrorMessage(error?.message ?? 'No se pudo cargar el panel de mesas.')
    } finally {
      setLoading(false)
    }
  }, [tenant?.id])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const setEstado = useCallback(
    async (mesaId: string, estado: EstadoMesa) => {
      if (!tenant?.id) return
      setSavingId(mesaId)
      setErrorMessage(null)
      try {
        await mesasService.setEstadoMesa(tenant.id, mesaId, estado)
        setMesas((prev) => prev.map((m) => (m.id === mesaId ? { ...m, estado } : m)))
        setMesaFeedback(mesaId, 'success', `Mesa actualizada a estado ${ESTADO_LABEL[estado]}.`)
      } catch (error: any) {
        const message = error?.message ?? 'No se pudo actualizar el estado de la mesa.'
        setErrorMessage(message)
        setMesaFeedback(mesaId, 'error', message)
      } finally {
        setSavingId(null)
      }
    },
    [tenant?.id, setMesaFeedback]
  )

  const handleCreateMesa = useCallback(async () => {
    if (!tenant?.id) return
    const numero = parseInt(nuevoNumero, 10)
    const capacidad = parseInt(nuevaCapacidad, 10)
    if (!Number.isFinite(numero) || numero <= 0) {
      setErrorMessage('Ingresá un número de mesa válido.')
      return
    }
    if (!Number.isFinite(capacidad) || capacidad <= 0) {
      setErrorMessage('Ingresá una capacidad válida.')
      return
    }

    setSavingId('new')
    setErrorMessage(null)
    try {
      const mesa = await mesasService.createMesa({
        tenantId: tenant.id,
        numero,
        capacidad,
        nombre: nuevoNombre.trim() || null,
        orden: numero,
      })
      setMesas((prev) => [...prev, mesa].sort((a, b) => a.orden - b.orden || a.numero - b.numero))
      setNuevoNumero('')
      setNuevaCapacidad('4')
      setNuevoNombre('')
      setShowNewMesa(false)
    } catch (error: any) {
      setErrorMessage(error?.message ?? 'No se pudo crear la mesa.')
    } finally {
      setSavingId(null)
    }
  }, [tenant?.id, nuevoNumero, nuevaCapacidad, nuevoNombre])

  const handleCreateReserva = useCallback(async () => {
    if (!tenant?.id || !reservaMesaId || !reservaNombre.trim() || !reservaAt) {
      setErrorMessage('Completá mesa, nombre y horario para crear la reserva.')
      return
    }

    setSavingId('reserva')
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      await mesasService.createReserva({
        tenantId: tenant.id,
        mesaId: reservaMesaId,
        nombre: reservaNombre.trim(),
        inicioAt: new Date(reservaAt).toISOString(),
        createdBy: usuario?.id ?? null,
      })
      setReservaNombre('')
      setReservaAt('')
      await loadData()
    } catch (error: any) {
      setErrorMessage(error?.message ?? 'No se pudo crear la reserva.')
    } finally {
      setSavingId(null)
    }
  }, [tenant?.id, reservaMesaId, reservaNombre, reservaAt, usuario?.id, loadData])

  const handleToggleMesaUnion = (mesaId: string) => {
    setUnionSelection((prev) => (prev.includes(mesaId) ? prev.filter((id) => id !== mesaId) : [...prev, mesaId]))
  }

  const handleCrearUnion = useCallback(async () => {
    if (!tenant?.id || unionSelection.length < 2) {
      setErrorMessage('Seleccioná al menos dos mesas para crear una unión.')
      return
    }
    setSavingId('union')
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      await mesasService.crearUnionMesas({
        tenantId: tenant.id,
        mesaIds: unionSelection,
        usuarioId: usuario?.id ?? null,
      })
      setUnionSelection([])
      await loadData()
    } catch (error: any) {
      setErrorMessage(error?.message ?? 'No se pudo crear la unión de mesas.')
    } finally {
      setSavingId(null)
    }
  }, [tenant?.id, unionSelection, usuario?.id, loadData])

  const handleCerrarUnion = useCallback(
    async (unionId: string) => {
      if (!tenant?.id) return
      setSavingId(`close-${unionId}`)
      setSuccessMessage(null)
      try {
        await mesasService.cerrarUnionMesas(tenant.id, unionId, usuario?.id ?? null)
        await loadData()
      } catch (error: any) {
        setErrorMessage(error?.message ?? 'No se pudo cerrar la unión.')
      } finally {
        setSavingId(null)
      }
    },
    [tenant?.id, usuario?.id, loadData]
  )

  const handleMoverPedido = useCallback(async () => {
    if (!tenant?.id || !moverMesaOrigenId || !moverMesaId) {
      setErrorMessage('Seleccioná mesa origen y mesa destino para mover.')
      return
    }
    if (moverMesaOrigenId === moverMesaId) {
      setErrorMessage('La mesa origen y destino no pueden ser la misma.')
      return
    }
    setSavingId('mover')
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      await mesasService.moverUltimoPedidoMesa({
        tenantId: tenant.id,
        mesaOrigenId: moverMesaOrigenId,
        mesaDestinoId: moverMesaId,
        usuarioId: usuario?.id ?? null,
      })
      setMoverMesaOrigenId('')
      setMoverMesaId('')
      setSuccessMessage('Pedido movido correctamente entre mesas.')
      await loadData()
    } catch (error: any) {
      setErrorMessage(error?.message ?? 'No se pudo mover el pedido de mesa.')
    } finally {
      setSavingId(null)
    }
  }, [tenant?.id, moverMesaOrigenId, moverMesaId, usuario?.id, loadData])

  const handleDividirCuentaMesa = useCallback(
    async (mesaId: string) => {
      if (!tenant?.id) return
      const raw = splitPartsByMesa[mesaId] ?? '2'
      const partes = parseInt(raw, 10)
      if (!Number.isFinite(partes) || partes < 2 || partes > 12) {
        const message = 'La división debe ser entre 2 y 12 partes.'
        setErrorMessage(message)
        setMesaFeedback(mesaId, 'error', message)
        return
      }

      setSplittingMesaId(mesaId)
      setErrorMessage(null)
      setSuccessMessage(null)
      try {
        const result = await mesasService.dividirUltimoPedidoMesaEntre({
          tenantId: tenant.id,
          mesaId,
          partes,
          createdBy: usuario?.id ?? null
        })
        const montosTxt = result.montos.map((m) => m.toLocaleString('es-PY')).join(' / ')
        setErrorMessage(null)
        setSplitPartsByMesa((prev) => ({ ...prev, [mesaId]: String(partes) }))
        await loadData()
        const message = `Cuenta dividida en ${result.partes} partes: ${montosTxt}`
        setSuccessMessage(message)
        setMesaFeedback(mesaId, 'success', message)
      } catch (error: any) {
        const message = error?.message ?? 'No se pudo dividir la cuenta de esta mesa.'
        setErrorMessage(message)
        setMesaFeedback(mesaId, 'error', message)
      } finally {
        setSplittingMesaId(null)
      }
    },
    [tenant?.id, splitPartsByMesa, usuario?.id, loadData, setMesaFeedback]
  )

  const reservasActivasPorMesa = useMemo(() => {
    const now = new Date()
    const map = new Map<string, MesaReserva[]>()
    for (const reserva of reservas) {
      if (!['pendiente', 'confirmada'].includes(reserva.estado)) continue
      const start = new Date(reserva.inicio_at)
      // En la tarjeta de mesa solo mostramos reservas del día actual.
      // Así evitamos que una reserva de mañana aparezca "activa" hoy.
      const sameDay =
        start.getFullYear() === now.getFullYear() &&
        start.getMonth() === now.getMonth() &&
        start.getDate() === now.getDate()
      if (!sameDay) continue
      const current = map.get(reserva.mesa_id) ?? []
      current.push(reserva)
      map.set(reserva.mesa_id, current)
    }
    return map
  }, [reservas])

  const reservasOrdenadas = useMemo(() => {
    return [...reservas].sort((a, b) => new Date(a.inicio_at).getTime() - new Date(b.inicio_at).getTime())
  }, [reservas])

  const handleDeleteReserva = useCallback(
    async (reserva: MesaReserva) => {
      if (!tenant?.id) return

      const inicio = new Date(reserva.inicio_at)
      const ahora = new Date()
      if (inicio.getTime() > ahora.getTime()) {
        setErrorMessage('Solo puedes eliminar reservas cuya fecha/hora ya pasó.')
        return
      }

      setDeletingReservaId(reserva.id)
      setErrorMessage(null)
      try {
        await mesasService.deleteReserva(tenant.id, reserva.id)
        await loadData()
      } catch (error: any) {
        setErrorMessage(error?.message ?? 'No se pudo eliminar la reserva.')
      } finally {
        setDeletingReservaId(null)
      }
    },
    [tenant?.id, loadData]
  )

  const resumen = useMemo(
    () => ({
      total: mesas.length,
      libres: mesas.filter((m) => m.estado === 'libre').length,
      ocupadas: mesas.filter((m) => m.estado === 'ocupada').length,
      reservadas: mesas.filter((m) => m.estado === 'reservada').length,
      bloqueadas: mesas.filter((m) => m.estado === 'bloqueada').length,
    }),
    [mesas]
  )

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <header className="rounded-3xl border border-white/40 dark:border-gray-800 bg-white/80 dark:bg-gray-900/70 backdrop-blur p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-orange-500">Panel Mesas</p>
                <h1 className="text-3xl font-black tracking-tight mt-1">Operación de salón {tenant?.nombre ? `· ${tenant.nombre}` : ''}</h1>
                <p className="text-gray-500 dark:text-gray-300 mt-2">
                  Gestioná ocupación, reservas y toma de pedidos por mesa sin romper el flujo actual de POS.
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
                  onClick={() => setShowNewMesa((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition"
                >
                  <PlusCircle className="w-4 h-4" />
                  Nueva mesa
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">
              <ResumenBadge label="Total" value={resumen.total} />
              <ResumenBadge label="Libres" value={resumen.libres} className="text-emerald-600" />
              <ResumenBadge label="Ocupadas" value={resumen.ocupadas} className="text-orange-600" />
              <ResumenBadge label="Reservadas" value={resumen.reservadas} className="text-blue-600" />
              <ResumenBadge label="Bloqueadas" value={resumen.bloqueadas} className="text-rose-600" />
            </div>

            {showNewMesa && (
              <div className="mt-5 rounded-2xl border border-orange-200 dark:border-orange-900/60 bg-orange-50/70 dark:bg-orange-950/20 p-4">
                <p className="text-sm font-semibold mb-3">Crear mesa</p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input
                    type="number"
                    min={1}
                    value={nuevoNumero}
                    onChange={(e) => setNuevoNumero(e.target.value)}
                    placeholder="Número"
                    className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm"
                  />
                  <input
                    type="text"
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    placeholder="Alias (opcional)"
                    className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm"
                  />
                  <input
                    type="number"
                    min={1}
                    value={nuevaCapacidad}
                    onChange={(e) => setNuevaCapacidad(e.target.value)}
                    placeholder="Capacidad"
                    className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleCreateMesa}
                    disabled={savingId === 'new'}
                    className="rounded-xl bg-emerald-600 text-white text-sm font-semibold px-3 py-2.5 hover:bg-emerald-700 transition disabled:opacity-60"
                  >
                    {savingId === 'new' ? 'Creando...' : 'Guardar mesa'}
                  </button>
                </div>
              </div>
            )}
          </header>

          {errorMessage && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
          )}
          {successMessage && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</div>
          )}

          {loading ? (
            <div className="rounded-3xl border border-white/40 dark:border-gray-800 bg-white/80 dark:bg-gray-900/70 p-10 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : mesas.length === 0 ? (
            <div className="rounded-3xl border border-white/40 dark:border-gray-800 bg-white/80 dark:bg-gray-900/70 p-10 text-center">
              <Table2 className="mx-auto w-10 h-10 text-gray-400 mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No hay mesas creadas aún. Podés crear la primera desde este panel o desde Administración.
              </p>
            </div>
          ) : (
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {mesas.map((mesa) => {
                const reservasMesa = reservasActivasPorMesa.get(mesa.id) ?? []
                const isActionsExpanded = expandedActionsByMesa[mesa.id] ?? false
                const mesaFeedback = mesaFeedbackById[mesa.id]
                return (
                  <article
                    key={mesa.id}
                    className="rounded-3xl border border-white/40 dark:border-gray-800 bg-white/85 dark:bg-gray-900/70 p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-gray-500">Mesa</p>
                        <h3 className="text-2xl font-black leading-none mt-1">#{mesa.numero}</h3>
                        <p className="text-sm text-gray-500 mt-2">{mesa.nombre?.trim() || 'Sin alias'} · {mesa.capacidad} pax</p>
                      </div>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${ESTADO_STYLES[mesa.estado]}`}>
                        {ESTADO_LABEL[mesa.estado]}
                      </span>
                    </div>

                    {reservasMesa.length > 0 && (
                      <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
                        <p className="text-xs font-semibold text-blue-700 mb-1">Reservas activas</p>
                        {reservasMesa.slice(0, 2).map((r) => (
                          <p key={r.id} className="text-xs text-blue-700">
                            {r.nombre_reserva} · {new Date(r.inicio_at).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={savingId === mesa.id}
                        onClick={() => setEstado(mesa.id, 'libre')}
                        className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-2 text-xs font-semibold hover:bg-emerald-100 transition"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                        Liberar
                      </button>
                      <button
                        type="button"
                        disabled={savingId === mesa.id}
                        onClick={() => setEstado(mesa.id, 'ocupada')}
                        className="rounded-xl border border-orange-200 bg-orange-50 text-orange-700 px-3 py-2 text-xs font-semibold hover:bg-orange-100 transition"
                      >
                        <CircleDot className="w-3.5 h-3.5 inline mr-1" />
                        Ocupar
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedActionsByMesa((prev) => ({
                          ...prev,
                          [mesa.id]: !isActionsExpanded
                        }))
                      }
                      className="mt-2 w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                    >
                      {isActionsExpanded ? 'Ocultar acciones avanzadas' : 'Más acciones'}
                    </button>
                    {isActionsExpanded && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={savingId === mesa.id}
                          onClick={() => setEstado(mesa.id, 'reservada')}
                          className="rounded-xl border border-blue-200 bg-blue-50 text-blue-700 px-3 py-2 text-xs font-semibold hover:bg-blue-100 transition"
                        >
                          <CalendarClock className="w-3.5 h-3.5 inline mr-1" />
                          Reservar
                        </button>
                        <button
                          type="button"
                          disabled={savingId === mesa.id}
                          onClick={() => setEstado(mesa.id, 'bloqueada')}
                          className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-xs font-semibold hover:bg-rose-100 transition"
                        >
                          <Lock className="w-3.5 h-3.5 inline mr-1" />
                          Bloquear
                        </button>
                      </div>
                    )}
                    {mesaFeedback && (
                      <p
                        className={`mt-2 text-[11px] ${
                          mesaFeedback.type === 'error' ? 'text-red-600' : 'text-emerald-600'
                        }`}
                      >
                        {mesaFeedback.message}
                      </p>
                    )}

                    <button
                      type="button"
                      disabled={mesa.estado === 'bloqueada'}
                      onClick={() => router.push(`${ROUTES.PROTECTED.POS}?mesaId=${mesa.id}`)}
                      className="mt-4 w-full rounded-xl bg-gray-900 dark:bg-gray-700 text-white text-sm font-semibold px-3 py-2.5 hover:opacity-90 transition disabled:opacity-50"
                    >
                      Tomar pedido en esta mesa
                    </button>

                    {mesa.estado === 'ocupada' && (
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleDividirCuentaMesa(mesa.id)}
                          disabled={splittingMesaId === mesa.id}
                          className="flex-1 rounded-xl bg-fuchsia-600 text-white text-sm font-semibold px-3 py-2.5 hover:bg-fuchsia-700 transition disabled:opacity-60"
                        >
                          {splittingMesaId === mesa.id ? 'Dividiendo...' : 'Dividir cuenta entre'}
                        </button>
                        <input
                          type="number"
                          min={2}
                          max={12}
                          value={splitPartsByMesa[mesa.id] ?? '2'}
                          onChange={(e) =>
                            setSplitPartsByMesa((prev) => ({
                              ...prev,
                              [mesa.id]: e.target.value
                            }))
                          }
                          className="w-20 rounded-xl border border-fuchsia-200 dark:border-fuchsia-800 bg-fuchsia-50/80 dark:bg-fuchsia-950/25 px-2.5 py-2 text-sm font-semibold text-center"
                        />
                      </div>
                    )}
                  </article>
                )
              })}
            </section>
          )}

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <article className="rounded-3xl border border-white/40 dark:border-gray-800 bg-white/85 dark:bg-gray-900/70 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-blue-500" />
                <h3 className="font-bold">Reservas</h3>
              </div>
              <select
                value={reservaMesaId}
                onChange={(e) => setReservaMesaId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm"
              >
                <option value="">Seleccionar mesa</option>
                {mesas.map((mesa) => (
                  <option key={mesa.id} value={mesa.id}>
                    Mesa #{mesa.numero} {mesa.nombre ? `· ${mesa.nombre}` : ''}
                  </option>
                ))}
              </select>
              <input
                value={reservaNombre}
                onChange={(e) => setReservaNombre(e.target.value)}
                placeholder="Nombre de la reserva"
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm"
              />
              <input
                type="datetime-local"
                value={reservaAt}
                onChange={(e) => setReservaAt(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm"
              />
              <button
                type="button"
                onClick={() => void handleCreateReserva()}
                disabled={savingId === 'reserva'}
                className="w-full rounded-xl bg-blue-600 text-white py-2.5 text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60"
              >
                {savingId === 'reserva' ? 'Guardando reserva...' : 'Crear reserva'}
              </button>
            </article>

            <article className="rounded-3xl border border-white/40 dark:border-gray-800 bg-white/85 dark:bg-gray-900/70 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <GitMerge className="w-4 h-4 text-violet-500" />
                <h3 className="font-bold">Unión de mesas</h3>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {mesas
                  .filter((m) => m.estado !== 'bloqueada')
                  .map((mesa) => (
                    <label key={mesa.id} className="inline-flex items-center gap-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1.5">
                      <input type="checkbox" checked={unionSelection.includes(mesa.id)} onChange={() => handleToggleMesaUnion(mesa.id)} />
                      Mesa #{mesa.numero}
                    </label>
                  ))}
              </div>
              <button
                type="button"
                onClick={() => void handleCrearUnion()}
                disabled={savingId === 'union' || unionSelection.length < 2}
                className="w-full rounded-xl bg-violet-600 text-white py-2.5 text-sm font-semibold hover:bg-violet-700 transition disabled:opacity-60"
              >
                {savingId === 'union' ? 'Creando unión...' : 'Unir mesas seleccionadas'}
              </button>
              <div className="space-y-2">
                {unionesActivas.map((union) => (
                  <div key={union.id} className="rounded-xl border border-violet-200/70 dark:border-violet-800/60 bg-violet-50/60 dark:bg-violet-950/20 px-3 py-2">
                    <p className="text-xs font-semibold">Unión {union.codigo || union.id.slice(0, 8)}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                      Mesas: {union.mesas.map((id) => mesas.find((m) => m.id === id)?.numero ?? '?').join(', ')}
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleCerrarUnion(union.id)}
                      disabled={savingId === `close-${union.id}`}
                      className="mt-2 rounded-lg border border-violet-300 dark:border-violet-700 px-2.5 py-1 text-xs font-semibold hover:bg-violet-100 dark:hover:bg-violet-900/40 transition"
                    >
                      Cerrar unión
                    </button>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-white/40 dark:border-gray-800 bg-white/85 dark:bg-gray-900/70 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <MoveHorizontal className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold">Mover pedido entre mesas</h3>
              </div>
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 p-3 space-y-2">
                <p className="text-xs font-semibold">Mover pedido de mesa</p>
                <select
                  value={moverMesaOrigenId}
                  onChange={(e) => setMoverMesaOrigenId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-2 text-xs"
                >
                  <option value="">Mesa origen</option>
                  {mesas
                    .filter((mesa) => mesa.estado === 'ocupada')
                    .map((mesa) => (
                      <option key={mesa.id} value={mesa.id}>
                        Mesa #{mesa.numero}
                      </option>
                    ))}
                </select>
                <select
                  value={moverMesaId}
                  onChange={(e) => setMoverMesaId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-2 text-xs"
                >
                  <option value="">Mesa destino</option>
                  {mesas
                    .filter((mesa) => mesa.estado !== 'bloqueada' && mesa.id !== moverMesaOrigenId)
                    .map((mesa) => (
                      <option key={mesa.id} value={mesa.id}>
                        Mesa #{mesa.numero}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={() => void handleMoverPedido()}
                  disabled={savingId === 'mover'}
                  className="w-full rounded-lg bg-amber-600 text-white py-2 text-xs font-semibold hover:bg-amber-700 transition disabled:opacity-60"
                >
                  {savingId === 'mover' ? 'Moviendo...' : 'Mover pedido'}
                </button>
              </div>
            </article>
          </section>

          <section className="rounded-3xl border border-white/40 dark:border-gray-800 bg-white/85 dark:bg-gray-900/70 p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="font-bold text-lg">Panel de reservas</h3>
              <span className="text-xs text-gray-500">
                Solo se puede eliminar cuando la fecha/hora de la reserva ya pasó.
              </span>
            </div>

            {reservasOrdenadas.length === 0 ? (
              <p className="text-sm text-gray-500">No hay reservas registradas.</p>
            ) : (
              <div className="space-y-2">
                {reservasOrdenadas.map((reserva) => {
                  const inicio = new Date(reserva.inicio_at)
                  const now = new Date()
                  const canDelete = inicio.getTime() <= now.getTime()
                  const mesa = mesas.find((m) => m.id === reserva.mesa_id)
                  return (
                    <div
                      key={reserva.id}
                      className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-3 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {reserva.nombre_reserva} · Mesa #{mesa?.numero ?? '?'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {inicio.toLocaleString('es-PY', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          · Estado {reserva.estado}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDeleteReserva(reserva)}
                        disabled={!canDelete || deletingReservaId === reserva.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-1.5 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        title={
                          canDelete
                            ? 'Eliminar reserva'
                            : 'Solo se elimina cuando ya pasó la fecha/hora'
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {deletingReservaId === reserva.id ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  )
}

function ResumenBadge({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`text-lg font-bold ${className ?? 'text-gray-900 dark:text-white'}`}>{value}</p>
    </div>
  )
}
