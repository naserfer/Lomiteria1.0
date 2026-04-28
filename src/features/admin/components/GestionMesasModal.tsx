'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, Table2, PlusCircle, Save, Trash2 } from 'lucide-react'
import { mesasService } from '@/features/mesas/services/mesasService'
import type { EstadoMesa, Mesa } from '@/features/mesas/types/mesas.types'

interface GestionMesasModalProps {
  open: boolean
  onClose: () => void
  tenantId: string
  onSaved?: () => void
  canDelete?: boolean
  usuarioId?: string | null
}

export function GestionMesasModal({
  open,
  onClose,
  tenantId,
  onSaved,
  canDelete = false,
  usuarioId = null
}: GestionMesasModalProps) {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingMesaId, setDeletingMesaId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [bulkCount, setBulkCount] = useState('10')
  const [bulkStartAt, setBulkStartAt] = useState('1')
  const [bulkCapacidad, setBulkCapacidad] = useState('4')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, { numero: string; nombre: string; capacidad: string; orden: string; estado: EstadoMesa; activa: boolean }>>({})

  const loadMesas = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const data = await mesasService.listMesas(tenantId)
      setMesas(data)
      const nextDrafts: Record<string, { numero: string; nombre: string; capacidad: string; orden: string; estado: EstadoMesa; activa: boolean }> = {}
      data.forEach((mesa) => {
        nextDrafts[mesa.id] = {
          numero: String(mesa.numero),
          nombre: mesa.nombre ?? '',
          capacidad: String(mesa.capacidad),
          orden: String(mesa.orden),
          estado: mesa.estado,
          activa: mesa.activa,
        }
      })
      setDrafts(nextDrafts)
    } catch (error: any) {
      setErrorMessage(error?.message ?? 'No se pudieron cargar las mesas.')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    void loadMesas()
  }, [open, loadMesas])

  const bulkPreview = useMemo(() => {
    const start = parseInt(bulkStartAt, 10)
    const count = parseInt(bulkCount, 10)
    if (!Number.isFinite(start) || !Number.isFinite(count) || start <= 0 || count <= 0) return []
    return Array.from({ length: Math.min(count, 30) }, (_, idx) => start + idx)
  }, [bulkStartAt, bulkCount])

  const handleBulkCreate = async () => {
    const start = parseInt(bulkStartAt, 10)
    const count = parseInt(bulkCount, 10)
    const capacidad = parseInt(bulkCapacidad, 10)
    if (!Number.isFinite(start) || start <= 0 || !Number.isFinite(count) || count <= 0 || count > 200) {
      setErrorMessage('Definí rango válido (inicio > 0 y cantidad entre 1 y 200).')
      return
    }
    if (!Number.isFinite(capacidad) || capacidad <= 0) {
      setErrorMessage('Capacidad inválida.')
      return
    }

    setSaving(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      for (let n = start; n < start + count; n += 1) {
        // idempotente en práctica: si existe número para tenant, la BD rechazará y continuamos.
        // eslint-disable-next-line no-await-in-loop
        await mesasService.createMesa({
          tenantId,
          numero: n,
          capacidad,
          orden: n,
        }).catch(() => null)
      }
      await loadMesas()
      setSuccessMessage(`Mesas cargadas/actualizadas en rango ${start} a ${start + count - 1}.`)
      onSaved?.()
    } finally {
      setSaving(false)
    }
  }

  const handleSaveMesa = async (mesaId: string) => {
    const draft = drafts[mesaId]
    if (!draft) return
    const numero = parseInt(draft.numero, 10)
    const capacidad = parseInt(draft.capacidad, 10)
    const orden = parseInt(draft.orden, 10)
    if (!Number.isFinite(numero) || numero <= 0 || !Number.isFinite(capacidad) || capacidad <= 0) {
      setErrorMessage('Número/capacidad inválidos.')
      return
    }

    setSaving(true)
    setErrorMessage(null)
    try {
      await mesasService.updateMesa(tenantId, mesaId, {
        numero,
        nombre: draft.nombre.trim() || null,
        capacidad,
        orden: Number.isFinite(orden) ? orden : numero,
        activa: draft.activa,
      })
      await mesasService.setEstadoMesa(tenantId, mesaId, draft.estado)
      await loadMesas()
      setEditingId(null)
      setSuccessMessage('Mesa actualizada correctamente.')
      onSaved?.()
    } catch (error: any) {
      setErrorMessage(error?.message ?? 'No se pudo guardar la mesa.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteMesa = async (mesa: Mesa) => {
    if (!canDelete) return
    const ok = window.confirm(`¿Eliminar la mesa #${mesa.numero}${mesa.nombre ? ` (${mesa.nombre})` : ''}?`)
    if (!ok) return

    setDeletingMesaId(mesa.id)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      await mesasService.deleteMesa({
        tenantId,
        mesaId: mesa.id,
        deletedBy: usuarioId,
        reason: 'eliminada_desde_admin'
      })
      await loadMesas()
      setEditingId((current) => (current === mesa.id ? null : current))
      setSuccessMessage(`Mesa #${mesa.numero} eliminada correctamente.`)
      onSaved?.()
    } catch (error: any) {
      setErrorMessage(error?.message ?? 'No se pudo eliminar la mesa.')
    } finally {
      setDeletingMesaId(null)
    }
  }

  if (!mounted || !open) return null

  const content = (
    <div className="fixed inset-0 z-[120] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-5xl max-h-[90vh] rounded-3xl border border-white/20 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-orange-100 dark:bg-orange-950/40 p-2.5">
              <Table2 className="w-5 h-5 text-orange-600 dark:text-orange-300" />
            </span>
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Gestión de mesas</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Editar mesas existentes y crear en lote por cantidad.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMessage && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{errorMessage}</div>}
          {successMessage && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">{successMessage}</div>}

          <section className="rounded-2xl border border-orange-200 dark:border-orange-900/40 bg-orange-50/70 dark:bg-orange-950/20 p-4">
            <p className="text-sm font-semibold mb-3">Crear mesas por cantidad</p>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <input value={bulkStartAt} onChange={(e) => setBulkStartAt(e.target.value)} type="number" min={1} placeholder="Desde número" className="rounded-xl border px-3 py-2.5 text-sm" />
              <input value={bulkCount} onChange={(e) => setBulkCount(e.target.value)} type="number" min={1} max={200} placeholder="Cantidad" className="rounded-xl border px-3 py-2.5 text-sm" />
              <input value={bulkCapacidad} onChange={(e) => setBulkCapacidad(e.target.value)} type="number" min={1} placeholder="Capacidad" className="rounded-xl border px-3 py-2.5 text-sm" />
              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={handleBulkCreate}
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-white text-sm font-semibold hover:bg-orange-600 transition disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                  Generar/Completar mesas
                </button>
              </div>
            </div>
            {bulkPreview.length > 0 && (
              <p className="text-xs text-gray-500 mt-2">Vista previa: {bulkPreview.join(', ')}{parseInt(bulkCount, 10) > bulkPreview.length ? ' ...' : ''}</p>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-sm font-semibold">
              Mesas existentes ({mesas.length})
            </div>
            {loading ? (
              <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
            ) : mesas.length === 0 ? (
              <div className="px-4 py-8 text-sm text-gray-500">No hay mesas configuradas aún.</div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {mesas.map((mesa) => {
                  const d = drafts[mesa.id]
                  const isEditing = editingId === mesa.id
                  return (
                    <div key={mesa.id} className="px-4 py-3">
                      {!isEditing || !d ? (
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold">Mesa #{mesa.numero} {mesa.nombre ? `· ${mesa.nombre}` : ''}</p>
                            <p className="text-xs text-gray-500">Capacidad {mesa.capacidad} · Estado {mesa.estado} · Orden {mesa.orden}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingId(mesa.id)}
                              className="rounded-xl border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                              Editar
                            </button>
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => void handleDeleteMesa(mesa)}
                                disabled={deletingMesaId === mesa.id || saving}
                                className="inline-flex items-center gap-1 rounded-xl border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                              >
                                {deletingMesaId === mesa.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                Eliminar
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
                          <input value={d.numero} onChange={(e) => setDrafts((prev) => ({ ...prev, [mesa.id]: { ...d, numero: e.target.value } }))} className="rounded-lg border px-2.5 py-2 text-sm" />
                          <input value={d.nombre} onChange={(e) => setDrafts((prev) => ({ ...prev, [mesa.id]: { ...d, nombre: e.target.value } }))} placeholder="Alias" className="rounded-lg border px-2.5 py-2 text-sm" />
                          <input value={d.capacidad} onChange={(e) => setDrafts((prev) => ({ ...prev, [mesa.id]: { ...d, capacidad: e.target.value } }))} className="rounded-lg border px-2.5 py-2 text-sm" />
                          <input value={d.orden} onChange={(e) => setDrafts((prev) => ({ ...prev, [mesa.id]: { ...d, orden: e.target.value } }))} className="rounded-lg border px-2.5 py-2 text-sm" />
                          <select value={d.estado} onChange={(e) => setDrafts((prev) => ({ ...prev, [mesa.id]: { ...d, estado: e.target.value as EstadoMesa } }))} className="rounded-lg border px-2.5 py-2 text-sm">
                            <option value="libre">Libre</option>
                            <option value="ocupada">Ocupada</option>
                            <option value="reservada">Reservada</option>
                            <option value="bloqueada">Bloqueada</option>
                          </select>
                          <label className="inline-flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={d.activa} onChange={(e) => setDrafts((prev) => ({ ...prev, [mesa.id]: { ...d, activa: e.target.checked } }))} />
                            Activa
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void handleSaveMesa(mesa.id)}
                              disabled={saving}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-2.5 py-2 text-xs font-semibold hover:bg-emerald-700 transition disabled:opacity-60"
                            >
                              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                              Guardar
                            </button>
                            <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border px-2.5 py-2 text-xs font-semibold">Cancelar</button>
                          </div>
                        </div>
                      )}
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

  return createPortal(content, document.body)
}
