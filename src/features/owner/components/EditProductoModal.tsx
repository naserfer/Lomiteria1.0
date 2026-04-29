'use client'

import { useEffect, useState, useId } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { X, Package, Loader2, ChefHat, Plus, Trash2 } from 'lucide-react'
import {
  listCategoriasOwner,
  listIngredientesOwner,
  getRecetaProductoOwner,
  updateProductoOwner,
} from '@/app/actions/owner'
import { useTenant } from '@/contexts/TenantContext'
import { normalizePuntosRetornoPct } from '@/features/pos/utils/pos.utils'

export interface ProductoEditShape {
  id: string
  nombre: string
  descripcion?: string | null
  precio: number
  disponible: boolean
  tiene_receta?: boolean
  imagen_url?: string | null
  categoria_id?: string | null
  puntos_extra?: number | null
}

interface EditProductoModalProps {
  open: boolean
  onClose: () => void
  tenantId: string
  producto: ProductoEditShape | null
  onSaved?: () => void
}

const safeTop = 'pt-[max(0.75rem,env(safe-area-inset-top))]'
const safeBottom = 'pb-[max(1rem,env(safe-area-inset-bottom))]'
const safeX = 'pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]'

const formatGuaranies = (value: string): string => {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

const parseGuaranies = (value: string): number =>
  parseInt(value.replace(/\./g, ''), 10) || 0

type RecetaLineaEditor = {
  ingrediente_id: string
  cantidad: number
  unidad: string
  obligatorio: boolean
  nombre: string
}

export function EditProductoModal({ open, onClose, tenantId, producto, onSaved }: EditProductoModalProps) {
  const { tenant } = useTenant()
  const retornoPct = normalizePuntosRetornoPct(
    tenant?.id === tenantId ? tenant.puntos_retorno_pct : undefined
  )
  const baseId = useId()
  const tabDatosId = `${baseId}-tab-datos`
  const tabRecetaId = `${baseId}-tab-receta`
  const panelDatosId = `${baseId}-panel-datos`
  const panelRecetaId = `${baseId}-panel-receta`

  const [mounted, setMounted] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<'datos' | 'receta'>('datos')

  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [precio, setPrecio] = useState('')
  const [disponible, setDisponible] = useState(true)
  const [imagenUrl, setImagenUrl] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [puntosExtra, setPuntosExtra] = useState<number>(0)

  const [categorias, setCategorias] = useState<{ id: string; nombre: string }[]>([])
  const [loadingCategorias, setLoadingCategorias] = useState(false)

  const [recipeLines, setRecipeLines] = useState<RecetaLineaEditor[]>([])
  const [recipeLoaded, setRecipeLoaded] = useState(false)
  const [recipeLoadError, setRecipeLoadError] = useState<string | null>(null)
  const [ingredientesCatalogo, setIngredientesCatalogo] = useState<{ id: string; nombre: string; unidad: string }[]>([])

  const [selectedIngredienteId, setSelectedIngredienteId] = useState('')
  const [cantidadNueva, setCantidadNueva] = useState('')
  const [obligatorioNuevo, setObligatorioNuevo] = useState(true)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open || !producto) return

    setNombre(producto.nombre)
    setDescripcion(producto.descripcion ?? '')
    setPrecio(formatGuaranies(String(producto.precio)))
    setDisponible(producto.disponible)
    setImagenUrl(producto.imagen_url ?? '')
    setCategoriaId(producto.categoria_id ?? '')
    setPuntosExtra(producto.puntos_extra ?? 0)
    setErrorMessage(null)
    setSuccessMessage(null)
    setActiveTab('datos')
    setSelectedIngredienteId('')
    setCantidadNueva('')
    setObligatorioNuevo(true)
  }, [open, producto])

  useEffect(() => {
    if (!open) return
    setLoadingCategorias(true)
    listCategoriasOwner(tenantId)
      .then((res) => setCategorias(res.categorias))
      .catch(() => {})
      .finally(() => setLoadingCategorias(false))
  }, [open, tenantId])

  useEffect(() => {
    if (!open || !producto) return

    if (!producto.tiene_receta) {
      setRecipeLines([])
      setRecipeLoaded(true)
      setRecipeLoadError(null)
      setIngredientesCatalogo([])
      return
    }

    let cancelled = false
    setRecipeLoaded(false)
    setRecipeLoadError(null)

    Promise.all([getRecetaProductoOwner(tenantId, producto.id), listIngredientesOwner(tenantId)])
      .then(([recRes, ingRes]) => {
        if (cancelled) return
        if (recRes.error) {
          setRecipeLoadError(recRes.error)
          setRecipeLines([])
        } else {
          setRecipeLines(
            recRes.lineas.map((l) => ({
              ingrediente_id: l.ingrediente_id,
              cantidad: l.cantidad,
              unidad: l.unidad,
              obligatorio: l.obligatorio,
              nombre: l.nombre,
            }))
          )
        }
        setIngredientesCatalogo(ingRes.ingredientes ?? [])
        setRecipeLoaded(true)
      })
      .catch(() => {
        if (!cancelled) {
          setRecipeLoadError('No se pudo cargar la receta')
          setRecipeLines([])
          setRecipeLoaded(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, producto, tenantId])

  useEffect(() => {
    if (!open) {
      setErrorMessage(null)
      setSuccessMessage(null)
    }
  }, [open])

  const tieneReceta = Boolean(producto?.tiene_receta)
  const saveDisabled = isSaving || (tieneReceta && !recipeLoaded)

  const handleAddIngrediente = () => {
    if (!selectedIngredienteId || !cantidadNueva.trim()) {
      setErrorMessage('Seleccioná un ingrediente y una cantidad válida')
      return
    }
    const qty = parseFloat(cantidadNueva.replace(',', '.'))
    if (!Number.isFinite(qty) || qty <= 0) {
      setErrorMessage('La cantidad debe ser mayor a cero')
      return
    }
    const ing = ingredientesCatalogo.find((i) => i.id === selectedIngredienteId)
    if (!ing) return
    if (recipeLines.some((r) => r.ingrediente_id === selectedIngredienteId)) {
      setErrorMessage('Este ingrediente ya está en la receta')
      return
    }
    setRecipeLines((prev) => [
      ...prev,
      {
        ingrediente_id: ing.id,
        cantidad: qty,
        unidad: ing.unidad,
        obligatorio: obligatorioNuevo,
        nombre: ing.nombre,
      },
    ])
    setSelectedIngredienteId('')
    setCantidadNueva('')
    setObligatorioNuevo(true)
    setErrorMessage(null)
  }

  const handleRemoveLine = (ingredienteId: string) => {
    setRecipeLines((prev) => prev.filter((r) => r.ingrediente_id !== ingredienteId))
  }

  const updateLine = (ingredienteId: string, patch: Partial<Pick<RecetaLineaEditor, 'cantidad' | 'unidad' | 'obligatorio'>>) => {
    setRecipeLines((prev) =>
      prev.map((r) => (r.ingrediente_id === ingredienteId ? { ...r, ...patch } : r))
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!producto) return
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!nombre.trim()) {
      setErrorMessage('El nombre del producto es obligatorio')
      return
    }

    const precioNum = parseGuaranies(precio)
    if (precioNum < 0) {
      setErrorMessage('El precio no puede ser negativo')
      return
    }

    if (producto.tiene_receta) {
      if (!recipeLoaded) {
        setErrorMessage('Esperá a que cargue la receta')
        return
      }
      if (recipeLines.length === 0) {
        setErrorMessage('Debés agregar al menos un ingrediente a la receta')
        setActiveTab('receta')
        return
      }
      for (const line of recipeLines) {
        if (!Number.isFinite(line.cantidad) || line.cantidad <= 0) {
          setErrorMessage('Cada ingrediente debe tener cantidad mayor a cero')
          setActiveTab('receta')
          return
        }
        if (!line.unidad?.trim()) {
          setErrorMessage('Cada línea debe tener unidad')
          setActiveTab('receta')
          return
        }
      }
    }

    setIsSaving(true)
    const result = await updateProductoOwner(producto.id, tenantId, {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      precio: precioNum,
      disponible,
      imagen_url: imagenUrl.trim() || null,
      categoria_id: categoriaId || null,
      puntos_extra: puntosExtra,
      ...(producto.tiene_receta
        ? {
            receta: recipeLines.map((r) => ({
              ingrediente_id: r.ingrediente_id,
              cantidad: r.cantidad,
              unidad: r.unidad.trim(),
              obligatorio: r.obligatorio,
            })),
          }
        : {}),
    })
    setIsSaving(false)

    if (result.error) {
      setErrorMessage(result.error)
      return
    }

    setSuccessMessage(`"${nombre.trim()}" actualizado correctamente`)
    setTimeout(() => {
      onSaved?.()
      onClose()
    }, 1200)
  }

  if (!mounted || !open || !producto) return null

  const idsEnReceta = new Set(recipeLines.map((r) => r.ingrediente_id))
  const ingredientesDisponibles = ingredientesCatalogo.filter((i) => !idsEnReceta.has(i.id))

  const modalContent = (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center ${safeTop} ${safeBottom} ${safeX} sm:p-4 bg-black/70 backdrop-blur-sm`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-producto-title"
    >
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/20 bg-white dark:bg-gray-900 shadow-2xl flex flex-col max-h-[min(90dvh,calc(100vh-2rem))] min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-5 py-4 sm:px-6 sm:py-5 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-xl bg-orange-500/10 p-2.5 shrink-0">
              <Package className="h-6 w-6 text-orange-500" />
            </div>
            <div className="min-w-0">
              <h2 id="edit-producto-title" className="text-xl font-bold text-gray-900 dark:text-white">
                Editar producto
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                {producto.nombre}
              </p>
              {!tieneReceta && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Sin receta / Combo — solo datos generales</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition disabled:opacity-50 shrink-0"
            aria-label="Cerrar"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {tieneReceta && (
          <div
            className="flex gap-1 border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 shrink-0"
            role="tablist"
            aria-label="Secciones del formulario"
          >
            <button
              type="button"
              role="tab"
              id={tabDatosId}
              aria-selected={activeTab === 'datos'}
              aria-controls={panelDatosId}
              onClick={() => setActiveTab('datos')}
              disabled={isSaving}
              className={`relative px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50 ${
                activeTab === 'datos'
                  ? 'text-orange-600 dark:text-orange-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Datos del producto
              {activeTab === 'datos' && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-orange-500" />
              )}
            </button>
            <button
              type="button"
              role="tab"
              id={tabRecetaId}
              aria-selected={activeTab === 'receta'}
              aria-controls={panelRecetaId}
              onClick={() => setActiveTab('receta')}
              disabled={isSaving}
              className={`relative inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50 ${
                activeTab === 'receta'
                  ? 'text-orange-600 dark:text-orange-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <ChefHat className="h-4 w-4 shrink-0" aria-hidden />
              Receta
              {activeTab === 'receta' && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-orange-500" />
              )}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 min-h-0 px-5 py-5 sm:px-6 sm:py-6 space-y-5">
            {errorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4">
                <p className="text-sm font-medium text-red-800 dark:text-red-300">{errorMessage}</p>
              </div>
            )}
            {successMessage && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 p-4">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">{successMessage}</p>
              </div>
            )}

            {/* Tab / panel: datos */}
            <div
              id={panelDatosId}
              role="tabpanel"
              aria-labelledby={tabDatosId}
              hidden={tieneReceta && activeTab !== 'datos'}
              className={tieneReceta && activeTab !== 'datos' ? 'hidden' : 'space-y-5'}
            >
              {/* Nombre */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  disabled={isSaving}
                  required
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Descripción (opcional)
                </label>
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={2}
                  disabled={isSaving}
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 disabled:opacity-50 resize-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Precio (Gs.) *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400 select-none">
                    Gs.
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={precio}
                    onChange={(e) => setPrecio(formatGuaranies(e.target.value))}
                    disabled={isSaving}
                    required
                    className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 pl-11 pr-4 py-3 text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Categoría
                </label>
                {loadingCategorias ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando...
                  </div>
                ) : (
                  <select
                    value={categoriaId}
                    onChange={(e) => setCategoriaId(e.target.value)}
                    disabled={isSaving}
                    className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-white focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 disabled:opacity-50"
                  >
                    <option value="">Sin categoría</option>
                    {categorias.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nombre}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="rounded-xl border border-yellow-200 dark:border-yellow-700/40 bg-yellow-50 dark:bg-yellow-900/10 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-500">⭐</span>
                  <span className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
                    Puntos bonus por unidad
                  </span>
                  <span className="text-xs text-yellow-600 dark:text-yellow-400 font-normal">(opcional)</span>
                </div>
                <p className="text-xs text-yellow-700 dark:text-yellow-400">
                  Puntos adicionales sobre la acumulación automática ({retornoPct}% del total del pedido, configurable en
                  Clientes).
                </p>
                <div className="flex rounded-xl border border-yellow-300 dark:border-yellow-700 bg-white dark:bg-gray-800 overflow-hidden focus-within:border-yellow-500 focus-within:ring-2 focus-within:ring-yellow-400/20 transition">
                  <span className="flex items-center px-3.5 text-sm font-semibold text-yellow-600 border-r border-yellow-200 dark:border-yellow-700 bg-yellow-100 dark:bg-yellow-900/30 select-none">
                    pts
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={puntosExtra}
                    onChange={(e) => setPuntosExtra(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    disabled={isSaving}
                    className="flex-1 bg-transparent px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none disabled:opacity-50"
                  />
                </div>
                {puntosExtra > 0 && (
                  <p className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
                    Bonus activo: +{puntosExtra} pts extra por unidad vendida
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Disponible en el menú</p>
                  <p className="text-xs text-gray-400 mt-0.5">Los clientes podrán verlo y pedirlo</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDisponible((v) => !v)}
                  disabled={isSaving}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                    disponible ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'
                  } disabled:opacity-50`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      disponible ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  URL de imagen (opcional)
                </label>
                <input
                  type="url"
                  value={imagenUrl}
                  onChange={(e) => setImagenUrl(e.target.value)}
                  placeholder="https://..."
                  disabled={isSaving}
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 disabled:opacity-50"
                />
                {imagenUrl && (
                  <Image
                    src={imagenUrl}
                    alt="Preview"
                    width={800}
                    height={96}
                    unoptimized
                    className="mt-2 h-24 w-full rounded-xl object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                )}
              </div>
            </div>

            {/* Tab / panel: receta */}
            {tieneReceta && (
              <div
                id={panelRecetaId}
                role="tabpanel"
                aria-labelledby={tabRecetaId}
                hidden={activeTab !== 'receta'}
                className={activeTab !== 'receta' ? 'hidden' : 'space-y-5'}
              >
                {!recipeLoaded ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-500 dark:text-gray-400">
                    <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                    <p className="text-sm">Cargando receta e ingredientes...</p>
                  </div>
                ) : (
                  <>
                    {recipeLoadError && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-4">
                        <p className="text-sm text-amber-800 dark:text-amber-200">{recipeLoadError}</p>
                      </div>
                    )}

                    <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Definí las materias primas que consume una unidad de este producto.
                      </p>
                    </div>

                    <div className="space-y-4 p-5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                      <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Agregar ingrediente</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-2">
                          <label htmlFor={`${baseId}-ing-select`} className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                            Materia prima
                          </label>
                          <select
                            id={`${baseId}-ing-select`}
                            value={selectedIngredienteId}
                            onChange={(e) => setSelectedIngredienteId(e.target.value)}
                            disabled={isSaving}
                            className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-white focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 disabled:opacity-50"
                          >
                            <option value="">Seleccionar...</option>
                            {ingredientesDisponibles.map((ing) => (
                              <option key={ing.id} value={ing.id}>
                                {ing.nombre} ({ing.unidad})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`${baseId}-cant-nueva`} className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                            Cantidad
                          </label>
                          <input
                            id={`${baseId}-cant-nueva`}
                            type="text"
                            inputMode="decimal"
                            value={cantidadNueva}
                            onChange={(e) => setCantidadNueva(e.target.value)}
                            placeholder="0"
                            disabled={isSaving}
                            className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-white focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 disabled:opacity-50"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          id={`${baseId}-oblig-nuevo`}
                          type="checkbox"
                          checked={obligatorioNuevo}
                          onChange={(e) => setObligatorioNuevo(e.target.checked)}
                          disabled={isSaving}
                          className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500 focus:ring-offset-0 disabled:opacity-50"
                        />
                        <label htmlFor={`${baseId}-oblig-nuevo`} className="text-sm cursor-pointer select-none text-gray-700 dark:text-gray-300">
                          Ingrediente obligatorio (no se puede quitar en el POS)
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddIngrediente}
                        disabled={isSaving || !selectedIngredienteId || !cantidadNueva.trim()}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-500/30 transition disabled:opacity-50"
                      >
                        <Plus className="w-5 h-5" />
                        Agregar a la receta
                      </button>
                    </div>

                    {recipeLines.length > 0 ? (
                      <div className="space-y-2">
                        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">
                          Ingredientes ({recipeLines.length})
                        </h3>
                        <ul className="space-y-3">
                          {recipeLines.map((line) => (
                            <li
                              key={line.ingrediente_id}
                              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 space-y-3"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <ChefHat className="w-5 h-5 text-gray-400 shrink-0" aria-hidden />
                                  <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                                    {line.nombre}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveLine(line.ingrediente_id)}
                                  disabled={isSaving}
                                  className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 text-red-500 transition disabled:opacity-50 shrink-0"
                                  aria-label={`Eliminar ${line.nombre} de la receta`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <div>
                                  <label
                                    className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                                    htmlFor={`${baseId}-qty-${line.ingrediente_id}`}
                                  >
                                    Cantidad
                                  </label>
                                  <input
                                    id={`${baseId}-qty-${line.ingrediente_id}`}
                                    type="text"
                                    inputMode="decimal"
                                    value={String(line.cantidad)}
                                    onChange={(e) => {
                                      const v = parseFloat(e.target.value.replace(',', '.'))
                                      if (e.target.value.trim() === '') {
                                        updateLine(line.ingrediente_id, { cantidad: 0 })
                                        return
                                      }
                                      if (Number.isFinite(v)) updateLine(line.ingrediente_id, { cantidad: v })
                                    }}
                                    disabled={isSaving}
                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 disabled:opacity-50"
                                  />
                                </div>
                                <div>
                                  <label
                                    className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                                    htmlFor={`${baseId}-unit-${line.ingrediente_id}`}
                                  >
                                    Unidad
                                  </label>
                                  <input
                                    id={`${baseId}-unit-${line.ingrediente_id}`}
                                    type="text"
                                    value={line.unidad}
                                    onChange={(e) => updateLine(line.ingrediente_id, { unidad: e.target.value })}
                                    disabled={isSaving}
                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 disabled:opacity-50"
                                  />
                                </div>
                                <div className="col-span-2 sm:col-span-1 flex items-end">
                                  <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-700 dark:text-gray-300">
                                    <input
                                      type="checkbox"
                                      checked={line.obligatorio}
                                      onChange={(e) =>
                                        updateLine(line.ingrediente_id, { obligatorio: e.target.checked })
                                      }
                                      disabled={isSaving}
                                      className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500 focus:ring-offset-0 disabled:opacity-50"
                                    />
                                    Obligatorio
                                  </label>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                        <ChefHat className="w-12 h-12 mx-auto mb-3 opacity-50" aria-hidden />
                        <p className="text-sm">No hay ingredientes en la receta</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-gray-200 dark:border-gray-800 px-5 py-4 sm:px-6 sm:py-4 flex flex-wrap justify-end gap-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4 bg-white dark:bg-gray-900">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saveDisabled}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/30"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar cambios'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
